import {GoogleApis} from "./apis";
import {cached} from "@ecmal/runtime/decorators";

export class GoogleApi {
    public api:GoogleApis;

    @cached
    public get compute(){
        return this.api.google_apis.compute('v1');
    }
    @cached
    public get appengine(){
        return this.api.google_apis.appengine('v1');
    }

    public get auth_client(){
        return this.api.auth_client;
    }

    constructor(api:GoogleApis){
        this.api = api;
    }
}