import {CmdServer} from "./cmd-server";
import {MemCacheServer} from "./memcache";
import {cached} from "@ecmal/runtime/decorators";
import {GoogleService} from "./services/google";
import {GoogleComputeApi} from "./google/gapi";
import {MetadataService} from "./services/metadata";


const http = require('http');
const url = require('url');
declare var process;

export const SERVER = {
    host : '0.0.0.0'
};


export class App{

    public network:any;

    public server:MemCacheServer;

    public cmd:CmdServer;

    @cached
    public get env(){
        return process.env.NODE_ENV || "local";
    }
    @cached
    public get is_prod(){
        return this.env == "production";
    }
    @cached
    public get is_gcp(){
        return !!process.env.GAE_VERSION
    }
    @cached
    public get instance_key(){
        let key = "instances";
        if(!this.is_prod){
           key = `${this.env}_${key}`;
        }
        return key;
    }
    @cached
    public get google(){
        return new GoogleService()
    }
    @cached
    public get metadata(){
        return new MetadataService()
    }
    @cached
    public get compute():GoogleComputeApi{
        return this.google.compute
    }

    constructor(){
        this.onMetadata = this.onMetadata.bind(this);
        this.google.onMetadataUpdate.attach(this.onMetadata);
    }

    public onMetadata(instances){
        console.info("METADATA",instances)
        this.server.connectClients(Object.keys(instances).reduce((p,c)=>{
            let instance = instances[c];
            if(!this.server.clients_config[c]){
                p[c] = instance
            }
            return p;
        },{}));
        this.server.clients_config = Object.assign(this.server.clients_config,instances);
    }

    public async initialize() {
        console.info('Initalizing')
        this.server = new MemCacheServer({
            host : SERVER.host,
            port : process.env.CACHE_PORT
        });
        this.server.listen();
        await this.google.init();
        let data = {};
        data[this.instance_key] = {};
        if(this.is_gcp){
            await this.metadata.init();
            console.info('NETWORK',this.metadata.network_config)
            if(this.metadata.network_config){
                this.network = {
                    ip      : this.metadata.network_config.ip,
                    ext_ip  : this.metadata.network_config.accessConfigs[0].externalIp
                };
                console.info('NETWORK2',this.network)


                data[this.instance_key][this.server.id] = {
                    host : this.network.ext_ip,
                    port : 7001
                };


            }
        }else {
            data[this.instance_key][this.server.id] = {
                host : '127.0.0.1',
                port : process.env.CACHE_PORT
            };
        }
        console.info('DATA',data)
        await this.compute.updateMetadata(data);
        console.info('Start Polling Metadata')
        this.google.startPolling();
        this.cmd = new CmdServer({
            host : SERVER.host,
            port : process.env.CMD_PORT
        },this.server);
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
