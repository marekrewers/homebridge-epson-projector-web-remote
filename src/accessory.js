module.exports = (api) => {
    api.registerAccessory('ProjectorSwitch', ProjectorSwitch);
};

const fetch = require('node-fetch');

class ProjectorSwitch {

    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.name = config.name;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.actionTimestamp = 0;
        this.overrideProjectorState = false;

        const {
            Manufacturer,
            SerialNumber,
            Identify,
            Name,
            Model,
            FirmwareRevision,
        } = this.Characteristic;

        this.defaults = {
            requestPath: '/cgi-bin/directsend',
            refererPath: '/cgi-bin/webconf',
            statusPath: '/cgi-bin/json_query?jsoncallback=HDMILINK?%2001&_=',
            key: {
                on_off: '3B',
            }
        }

        this.config.referer = `http://${this.config.ip}${this.defaults.refererPath}`;

        this.projectorService = new this.Service.Switch(this.name, '00000049-0000-1000-8000-0026BB765291');

        this.informationService = new this.Service.AccessoryInformation()
            .setCharacteristic(Manufacturer, "EPSON")
            .setCharacteristic(SerialNumber, '0')
            .setCharacteristic(Identify, false)
            .setCharacteristic(Name, this.name)
            .setCharacteristic(Model, 'TW-5650')
            .setCharacteristic(FirmwareRevision, '1.0.0');

        this.projectorService.getCharacteristic(this.Characteristic.On)
            .onGet(this.getSwitchValue.bind(this))
            .onSet(this.setSwitchValue.bind(this));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getSwitchValue() {

        // keep status 'ON' for 14 seconds since boot up.
        if (this.overrideProjectorState && this.actionTimestamp + 14000 < Date.now()) {
            return true;
        } else {
            this.actionTimestamp = 0;
            this.overrideProjectorState = false;
        }

        const {ip, referer} = this.config;
        const {statusPath} = this.defaults;
        const {error} = this.log;

        const requestUrl = `http://${ip}${statusPath}${Date.now()}`;

        try {
            const result = await fetch(requestUrl, {
                headers: {
                    referer,
                },
            });

            const jsonResponse = await result.json();

            return jsonResponse.projector.feature.reply === '01'
        } catch (e) {
            error(`Failed to get projector status: ${e.message}`);
        }
    }

    async setSwitchValue(state) {
        const { On } = this.Characteristic;
        const { on_off } = this.defaults.key;
        const { error } = this.log;

        try {
            await this.sendKeyCode(on_off, state);

            this.overrideProjectorState = state;

            if (state) {
                // keep the switch 'on' for a few seconds after powering the projector.
                this.actionTimestamp = Date.now();
            } else {
                await this.sleep(1000);
                await this.sendKeyCode(on_off);
                this.overrideProjectorState = false;
            }

            this.projectorService.getCharacteristic(On)
                .updateValue(state);

        } catch (e) {
            error(`Failed to set projector status value: ${e.message}`)
        }
    }

    async sendKeyCode(key, state) {
        const {ip, referer} = this.config;
        const {requestPath} = this.defaults;
        const {error} = this.log;

        const requestUrl = `http://${ip}${requestPath}?KEY=${key}&_=${Date.now()}`;

        try {
            if (state) {
                return fetch(requestUrl, {headers: {Referer: referer}});
            } else {
                await fetch(requestUrl, {headers: {Referer: referer}});
            }
        } catch (e) {
            error(`Failed sending key code: ${e.message}`);
        }
    }

    getServices() {
        return [
            this.informationService,
            this.projectorService,
        ];
    }
}