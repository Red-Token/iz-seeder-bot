import {spawn} from 'node:child_process'
import EventEmitter from 'node:events'

export function mp4box(inFile?: string) {
    return new MP4Box(inFile)
}

export class MP4Box extends EventEmitter {
    private options: string[] = []
    private files: string[] = []

    constructor(inFile?: string) {
        super()

        if (inFile !== undefined) {
            this.options.push(inFile)
        }
    }

    addOption(...options: string[]): MP4Box {
        this.options.push(...options)
        return this
    }

    addInputFiles(...files: string[]): MP4Box {
        this.options.push(...files)
        return this
    }

    // addListener(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;

    run() {
        const process = spawn('MP4Box', [...this.options, ...this.files])

        process.stderr.on('data', (data: Buffer) => {
            const str = data.toString()
            // if (!str.startsWith('\x1b[37m'))
            //     return
            console.log('BEEP2')
            console.log(str)
            console.log('BEEP2')
        })

        process.on('close', (code, signal) => {
            if (code == 0) {
                this.emit('end')
                return
            }

            this.emit('error', new Error('MP4Box failed with code ' + code))
        })
    }

}
