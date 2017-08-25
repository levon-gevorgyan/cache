import {TcpServer} from "./server";
import {MemCacheServer} from "./memcache";

export class CmdServer extends TcpServer {
    public cache_server:MemCacheServer;

    constructor(options,tcp_server){
        super(options);
        this.cache_server = tcp_server;
        this.listen();
        this.onCommand = this.onCommand.bind(this);
        this.onDataSignal.attach(this.onCommand)
    }

    public onCommand(id,data:any){
        data = data.match(/(get|set) ([0-9a-z]+)(\s\"(.*)\")?/i);
        let conn = this.getConnection(id);
        if(data){
            let command = data[1];
            let key     = data[2];
            let value   = data[4];
            let promise;
            switch (command){
                case "get" : promise = this.onGet(key); break;
                case "set" : promise = this.onSet(key,value); break;
            }
            return promise.then(r=>{
                conn.write(`Response: ${r}\n\r`);
            })
        }else {
            conn.write('Response: Invalid Command\n\r')
        }
    }
    public onGet(key){
        return Promise.resolve(this.cache_server.cache[key]);
    }
    public onSet(key,value){
        return this.cache_server.broadcast({
            id      : this.cache_server.id,
            action  : 'set',
            key     : key,
            value   : value
        }).then(r=>{
            return true;
        }).catch(e=>{
            return false;
        })
    }
}