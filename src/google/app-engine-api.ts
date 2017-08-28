import {GoogleApis} from "./apis";
import {GoogleApi} from "./api";

declare var process;

export class GoogleAppEngineApi extends  GoogleApi{

    constructor(api:GoogleApis){
        super(api);
    }

    protected request(data={}){
        return Object.assign({
            auth    : this.auth_client,
            appsId  : process.env.GCLOUD_PROJECT
        },data)
    }

    public listInstances(){
        return new Promise((accept,reject)=>{
            this.appengine.apps.services.versions.instances.list(this.request({
                servicesId : process.env.GAE_SERVICE,
                versionsId : process.env.GAE_VERSION
            }),(err, response) =>{
                if (err) {
                    console.error(err);
                    reject(err)
                }
                //console.log(JSON.stringify(response, null, 2));
                accept(response);
            });
        })
    }
}