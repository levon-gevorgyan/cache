import {Strings} from "./common/strings";
import {cached, signal, Signal} from "@ecmal/runtime/decorators";

const net = require('net');

export class TcpClient {
    public id:string;
    public socket:any;
    public options:any;
    public attempts_config:number;
    public reconnect_attempts:number;

    @cached
    public get address(){
        return `${this.options.host}:${this.options.port}`;
    }

    @signal
    public onDataSignal:Signal<Function>;


    constructor (options){
        this.id         = Strings.guid(8);
        this.options    = options;
        this.socket     = new net.Socket();
        this.attempts_config = this.reconnect_attempts = 10;
        this.onData     = this.onData.bind(this);
    }

    public print(...args){
        args.unshift(this.address);
        console.info.apply(null,args);
    }


    public reconnect(once = false){
        return new Promise((accept,reject)=>{
            try {
                let removeListeners = ()=>{
                    this.socket.removeListener('close', onClose);
                    this.socket.removeListener('end', onEnd);
                    this.socket.removeListener('error', onError);
                    this.socket.removeListener('connect', onConnect);
                    this.socket.removeListener('data', this.onData);
                };
                let tryAgain = ()=>{
                    removeListeners();
                    if(once){
                        once = false;
                        reject()
                    }else {
                        if(this.reconnect_attempts != 0){
                            this.reconnect_attempts--;
                            setTimeout(()=>{
                                this.reconnect()
                            },5000);
                            this.print('Reconnecting attempts left', this.reconnect_attempts);
                        }else {
                            this.print('Reconnecting Stopped');
                            this.onDataSignal(JSON.stringify({
                                action : 'stop-reconnect',
                                client : this.options
                            }))
                        }


                    }
                };
                let onClose = ()=>{
                    console.log(this.id,'Connection closed');
                    tryAgain();
                };
                let onEnd = ()=>{
                    console.log(this.id,'Connection ended');
                    tryAgain();
                };
                let onError = (e)=>{
                    console.log(this.address,'Error',e.message || e);
                    removeListeners();
                    tryAgain();
                };
                let onConnect = (e)=>{
                    once = false;
                    console.info(`${this.constructor.name} ${this.id} Connected to ${this.address}`);
                    accept()
                };
                this.socket.on('close', onClose);
                this.socket.on('end', onEnd);
                this.socket.on('error', onError);
                this.socket.on('connect', onConnect);
                this.socket.connect(this.options);
            }catch (e){
                reject(e)
            }
        }).then(r=>{
            if(this.reconnect_attempts != this.attempts_config){
                this.reconnect_attempts = this.attempts_config;
            }
            this.socket.on('data', this.onData);
            return r;
        })
    }

    private onData(data){
        //console.log('Received: ' + data);
        this.onDataSignal(data.toString())
    }
}