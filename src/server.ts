import {signal, Signal} from "@ecmal/runtime/decorators";
import {Strings} from "./common/strings";

const net = require('net');

export class TcpServer {

    public server:any;
    public options:any;
    public connections:{[k:string]:TcpConnection};

    @signal
    public onDataSignal:Signal<Function>;

    @signal
    public onConnectionSignal:Signal<Function>;

    constructor(options){
        this.connections    = Object.create(null);
        this.options        = options;
        this.server         = net.createServer(c=>{
            let id = Strings.guid();
            console.info(`${this.constructor.name}:CLIENT: ${c.remoteAddress}:${c.remotePort}`)
            this.connections[id] = new TcpConnection({
                id          : id,
                server      : this,
                connection  : c
            });
            this.onConnectionSignal(this.connections[id]);
        })
    }

    public getConnection(id){
        return this.connections[id];
    }

    public listen(){
        if(!this.server.listening){
            this.server.listen(this.options);
            console.info(`${this.constructor.name}: listening ${this.options.host}:${this.options.port}`)
        }
    }

    public broadcast(data){
        return Promise.all(Object.keys(this.connections).map(k=>{
            return this.connections[k].sendJson(data)
        }))
    }
}

export class TcpConnection {
    public id:string;
    public server:TcpServer;
    public connection:any;

    constructor(options){
        this.id         = options.id;
        this.server     = options.server;
        this.connection = options.connection;
        this.connection.on('end',()=>{
            console.log(this.id,'client disconnected');
            delete this.server.connections[this.id];
        });
        this.connection.on('data',(data)=>{
            this.server.onDataSignal(this.id,data.toString().trim())
        })
    }

    public write(data){
        return new Promise((accept,reject)=>{
            try {
                this.connection.write(data,()=>{
                    accept()
                });
            }catch (e){
                reject(e)
            }
        })
    }

    public sendJson(data){
        try{
            data = JSON.stringify(data);
            return this.write(data);
        }catch(e){
            return Promise.reject(e);
        }
    }


}