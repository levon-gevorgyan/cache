import {CmdServer} from "./cmd-server";
import {MemCacheServer} from "./memcache";
import {cached, signal, Signal} from "@ecmal/runtime/decorators";
import {GoogleService} from "./services/google";
import {MetadataService} from "./services/metadata";


const http = require('http');
const url = require('url');
declare var process;


export class App{

    public servers:any;

    public server:MemCacheServer;

    public cmd:CmdServer;

    @signal
    public onNetworkConfigUpdate:Signal<Function>;

    @cached
    public get process(){
        return process;
    }

    @cached
    public get env(){
        return process.env.NODE_ENV || "local";
    }
    @cached
    public get gae_project(){
        return process.env.GCLOUD_PROJECT;
    }
    @cached
    public get gae_service(){
        return process.env.GAE_SERVICE;
    }
    @cached
    public get is_prod(){
        return this.env == "production";
    }
    @cached
    public get google(){
        return new GoogleService()
    }
    @cached
    public get metadata(){
        return new MetadataService()
    }

    constructor(){
        this.servers = Object.create(null);
    }

    public async initLocal(){
        this.servers = process.env.SERVER_PORTS.split(',').map(p=>{
            return {
                host : 'localhost',
                port : p
            }
        });
        this.server.connectClients(this.servers);
    }

    public async initProd(){
        this.onNetworkConfigUpdate.attach((config)=>{
            console.info('CONFIG_UPDATE',config)
            this.server.connectClients(config);
            Object.assign(this.servers,config);
        })
    }

    public async initialize() {
        console.info(`Initializing on ${this.env}`);
        this.server = new MemCacheServer({
            host : '0.0.0.0',
            port : process.env.CACHE_PORT
        });
        this.server.listen();
        this.cmd = new CmdServer({
            host : '0.0.0.0',
            port : process.env.CMD_PORT
        },this.server);
        if(this.is_prod){
            await this.initProd();
        }else {
            await this.initLocal();
        }
        await this.google.start();
        this.startHttpServer();
    }

    public startHttpServer(){
        let port = process.env.PORT || 4000;
        http.createServer((req, res) => {
            let promise = Promise.resolve();
            let data:any = {
                id : this.server.id
            };
            let query = url.parse(req.url,true).query;
            let get = query.get;
            if(get){
                promise = promise.then(r=>{
                    return this.cmd.onGet(get).then(r=>{
                        if(r){
                            data.get = {
                                id          : get,
                                value       : r,
                                not_exist   : false
                            }
                        }else {
                            data.get = {
                                id          : get,
                                not_exist   : true
                            };
                        }
                        return Promise.resolve();
                    });
                })
            }
            if(query.set){
                let value:any = query.value;
                try {
                    value = JSON.parse(value);
                }catch (e){
                    let num = Number(value);
                    if(num){
                        value = num;
                    }
                }
                promise = promise.then(r=>{
                    return this.cmd.onSet(query.set,value).then(r=>{
                        data.set = {
                            id      : query.set,
                            data    : value,
                            result  : r
                        };
                        return Promise.resolve();
                    })

                });
            }
            promise.then(r=>{
                res.writeHead(200, {"Content-Type": "application/json"});
                res.end(JSON.stringify(data));
            })
        }).listen(port);
    }

}
export const app = new App();
export default app;


export async function main() {
    process.on('unhandledRejection', (reason) => {
        console.error(reason);
    });
    return await app.initialize();
}
