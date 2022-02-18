module.exports = (api) => {
    api.registerAccessory('ProjectorSwitch', ProjectorSwitch);
};

const fetch = require('node-fetch-retry');

class ProjectorSwitch {

    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.name = config.name;

        this.defaults = {
            requestPath: '/cgi-bin/directsend',
            refererPath: '/cgi-bin/webconf',
            statusPath: '/cgi-bin/json_query?jsoncallback=HDMILINK?%2001&_=',
            key: {
                on_off: '3B',
            }
        }

        this.config.referer = `http://${this.config.ip}${this.defaults.refererPath}`;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.projectorService = new this.Service.Switch(this.name, '00000049-0000-1000-8000-0026BB765291');

        this.informationService = new this.Service.AccessoryInformation()
            .setCharacteristic(this.Characteristic.Manufacturer, "EPSON")
            .setCharacteristic(this.Characteristic.SerialNumber, '0')
            .setCharacteristic(this.Characteristic.Identify, false)
            .setCharacteristic(this.Characteristic.Name, this.name)
            .setCharacteristic(this.Characteristic.Model, 'TW-5650')
            .setCharacteristic(this.Characteristic.FirmwareRevision, '1.0.0');

        this.projectorService.getCharacteristic(this.Characteristic.On)
            .onGet(this.getSwitchValue.bind(this))
            .onSet(this.setSwitchValue.bind(this));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getSwitchValue() {
        const { ip, referer } = this.config;
        const { statusPath } = this.defaults;
        const { error } = this.log;

        const timestamp = Date.now();
        const requestUrl = `http://${ip}${statusPath}${timestamp}`;

        try {
            const result = await fetch(requestUrl, {
                headers: {
                    referer,
                },
                retry: 10,
                pause: 1000,
            });

            const jsonResponse = await result.json();

            const status = jsonResponse.projector.feature.reply === "01"; // on

            return status;
        } catch (e) {
            error(`Failed to get projector status: ${e.message}`);
        }
    }

    async setSwitchValue(value) {
        const { error } = this.log;

        try {
            await this.sendKeyCode(this.defaults.key.on_off);

            if (value) {
                await this.sleep(1000);
                await this.sendKeyCode(this.defaults.key.on_off);
            }

            this.projectorService.getCharacteristic(this.Characteristic.On)
                .updateValue(value);
        } catch (e) {
            error(`Failed to set projector status value: ${e.message}`)
        }
    }

    async sendKeyCode(key) {
        const { ip, referer } = this.config;
        const { requestPath } = this.defaults;
        const { error } = this.log;

        const requestUrl = `http://${ip}${requestPath}?KEY=${key}&_=${Date.now()}`;

        try {
            const result = await fetch(requestUrl, {
                headers: {
                    Referer: referer,
                },
                retry: 10,
                pause: 1000,
            });
            return result;
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