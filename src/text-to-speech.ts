import * as googleTTS from "google-tts-api";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import * as download from "download";
import * as _ from "lodash";
import {LocalizationService} from "./localization-service";


export class TextToSpeech {
    /**
     * Get a local sound file that corresponds to input string;
     * Local file may be cached, if not, pull from other sources
     * @param {string} text
     * @returns {Promise<void>}
     */
    public static async getFileName(text: string) {
        const hash = TextToSpeech.hashText(text);
        const folder = path.join('voice_cache', LocalizationService.getLocale());
        const filePath = path.join(process.cwd(), folder, hash);

        if (!fs.existsSync(filePath)) {
            let locale = LocalizationService.getLocale();
            const url = await googleTTS(text, locale, Number(process.env.TTS_SPEED || 1));
            await download(url, folder, {
                filename: hash,
            });
        }

        return filePath;
    }

    private static hashText(text: string) {
        return crypto.createHmac('sha256', '0xdeadbeef')
            .update(text)
            .digest('hex');
    }

    private static timeoutHandles;

    /**
     * Say all info in a timemap; note this function returns after the time map entries are started to be spoken, not when they have all finished
     * @param timeMap
     * @param {(text) => Promise<any>} sayDelegate
     * @param startNow
     * @returns {Promise<void>}
     */
    public async sayTimeMap(timeMap: {[time: string]: string[]}, sayDelegate: (text) => Promise<any>, startNow: boolean) {
        this.clearTimeout();
        let values = _.flatten(Object.values(timeMap));

        await Promise.all(values.map(text => TextToSpeech.getFileName(text)));

        let timerStart = LocalizationService.get('timer-start');
        if (!startNow) {
            await sayDelegate(LocalizationService.get('timer-count-down'));
            await sayDelegate(timerStart);
        }

        TextToSpeech.timeoutHandles = Object.entries(timeMap)
            .map(([key, value]) => {
                return setTimeout(async () => {
                    for (const text of value) {
                        await sayDelegate(text);
                    }
                }, Number(key) * 1000);
            });

        if (startNow) {
            await sayDelegate(timerStart);
        }
    }

    public clearTimeout() {
        if (TextToSpeech.timeoutHandles) {
            TextToSpeech.timeoutHandles.forEach(id => clearTimeout(id));
            TextToSpeech.timeoutHandles = null;
        }
    }
}