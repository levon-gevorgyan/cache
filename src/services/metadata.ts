import {HttpRequest} from "../common/http-request";
import {cached} from "@ecmal/runtime/decorators";

export class MetadataService extends HttpRequest {

    public network_config:any;

    @cached
    public get base(){
        return 'metadata.google.internal'
    }
    @cached
    private get project_path(){
        return '/computeMetadata/v1/project/';
    }
    @cached
    private get instance_path(){
        return '/computeMetadata/v1/instance/';
    }

    public getProjectMetadata(){
        return this.get(`${this.project_path}attributes/?recursive=true`)
    }
    public getNetworkInterfaces(){
        return this.get(`${this.instance_path}network-interfaces/?recursive=true`)
    }

    public get(path){
        let options = {
            host    : this.base,
            path    : path,
            headers : {
                'Metadata-Flavor' : 'Google'
            }
        };
        return MetadataService.get(options).then((r:any)=>r.data)
    }

    public async init(){
        //let metadata = await this.getProjectMetadata();
        let net = await this.getNetworkInterfaces();
        this.network_config = net[0];
        //console.info('GOOGLE METADATA', metadata);
        console.info('GOOGLE NETWORK', JSON.stringify(this.network_config));
    }
}