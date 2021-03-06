import {TcpConnection, TcpServer} from "./server";
import {TcpClient} from "./client";
import {cached} from "@ecmal/runtime/decorators";
import app from "./app"

declare var process;


export class MemCacheServer extends TcpServer {
    public cache:any;
    public clients:TcpClient[];

    public clients_config:any;

    @cached
    public get id(){
        return process.env.GAE_INSTANCE || process.env.ID;
    }

    constructor(options){
        super(options);
        this.clients_config = {};
        this.cache  = Object.create(null);
        this.onData = this.onData.bind(this);
        this.onConnection = this.onConnection.bind(this);
        this.onDataSignal.attach(this.onData);
        this.onConnectionSignal.attach(this.onConnection);
    }

    public onData(id,data){
        console.info('MEM',id,data)
    }
    public connectClients(config?){
        config = config || this.clients_config;
        this.clients = Object.keys(config).map(k=>new TcpClient(config[k]));
        let count = Object.keys(config).length;
        let welcome = [];
        console.info('ALL',count)
        let onWelcome = (data) =>{
            if(data.id != this.id){
                welcome.push(data);
            }
            if(!count){
                if(welcome.length){
                    this.cache = welcome[0].data;
                }
            }
        };
        this.clients.forEach(c=>{
            c.reconnect(true).then(r=>{
                count--;
                console.info('SUCCESS',count)
            }).catch(e=>{
                count--;
                setTimeout(()=>{
                    c.reconnect();
                },5000);
                console.info('REJECT',e,count)
            });
            c.onDataSignal.attach((data)=>{
                console.info(this.id,'onDataSignal',data)
                data = JSON.parse(data);
                switch (data.action){
                    case 'welcome'          : onWelcome(data); break;
                    case 'set'              : this.onSet(data); break;
                    case 'stop-reconnect'   : this.onStopReconnect(data); break;
                }
            })
        })
    }

    public onSet(data){
        this.cache[data.key] = data.value;
    }
    public onStopReconnect(data){
        let client = data.client;
        let instance = Object.keys(this.clients_config).filter(k=>{
            let c = this.clients_config[k];
            return c.host == client.host && c.port == client.port;
        })[0];
        if(instance){
            let data = {};
            data[app.instance_key] = {};
            app.compute.updateMetadata(data,[`${app.instance_key}.${instance}`])
        }

    }

    public onConnection(c:TcpConnection){
        c.sendJson({
            id      : this.id,
            action  : 'welcome',
            data    : this.cache
        })
    }
}