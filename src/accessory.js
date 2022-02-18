module.exports = (api) => {
    api.registerAccessory('ProjectorSwitch', ProjectorSwitch);
};

const fetch = require('node-fetch-retry');

class ProjectorSwitch {

    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

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

        this.name = config.name;

        this.service = new this.Service.Switch(this.name, '00000049-0000-1000-8000-0026BB765291');

        this.informationService = new this.Service.AccessoryInformation()
            .setCharacteristic(this.Characteristic.Manufacturer, "EPSON")
            .setCharacteristic(this.Characteristic.SerialNumber, Date.now())
            .setCharacteristic(this.Characteristic.Identify, false)
            .setCharacteristic(this.Characteristic.Name, this.name)
            .setCharacteristic(this.Characteristic.Model, 'TW-5650')
            .setCharacteristic(this.Characteristic.FirmwareRevision, '1.0.0');

        // create handlers for required characteristics
        this.service.getCharacteristic(this.Characteristic.On)
            .onGet(this.getSwitchValue.bind(this))
            .onSet(this.setSwitchValue.bind(this));
    }

    // /**
    //  * Handle requests to get the current value of the "Programmable Switch Event" characteristic
    //  */
    // getSwitchEvent() {
    //     this.log.debug('Triggered GET ProgrammableSwitchEvent');
    //
    //     return this.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
    // }

    /**
     * Handle requests to get the current value of the "Programmable Switch Output State" characteristic
     */
    async getSwitchValue() {
        const { ip, referer } = this.config;
        const { statusPath } = this.defaults;

        this.log.debug('Triggered GET ProgrammableSwitchOutputState');

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

            this.log.debug(`Switch status is: ${status}`);
            console.log(status, jsonResponse.projector.feature.reply);

            return status;
        } catch (e) {
            console.log(`Failed to get switch value: ${e.message}`);
            this.log.debug(`Failed to get switch value: ${e.message}`);
        }
    }

    /**
     * Handle requests to set the "Programmable Switch Output State" characteristic
     */
    async setSwitchValue(value) {
        this.log.debug(`Triggered SET ProgrammableSwitchOutputState: ${value}`);

        if (this.Characteristic.On === 0) {
            await this.sendKeyCode(this.defaults.key.on_off);
            this.service.getCharacteristic(this.Characteristic.On)
                .updateValue(true);
        } else {
            await this.sendKeyCode(this.defaults.key.on_off);
            await this.sendKeyCode(this.defaults.key.on_off);
            this.service.getCharacteristic(this.Characteristic.On)
                .updateValue(false);
        }
    }

    async sendKeyCode(key) {
        const { ip, referer } = this.config;
        const { requestPath } = this.defaults;
        const timestamp = Date.now();

        const requestUrl = `http://${ip}/${requestPath}?KEY=${key}&_=${timestamp}`;

        try {
            const result = await fetch(requestUrl, {
                headers: {
                    Referer: referer,
                },
                retry: 10,
                pause: 1000,
            });

            this.log.debug(`Requested key code ${key}`);

            console.log(result);
            return result;
        } catch (e) {
            this.log.debug(`Failed sending key code: ${e.message}`);
            return e;
        }
    }
    getServices() {
        return [
            this.informationService,
            this.service,
        ];
    }
}