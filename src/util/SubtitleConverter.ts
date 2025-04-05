import ffmpeg from 'fluent-ffmpeg'
import {mp4box, MP4Box} from '../gpac/MP4Box.js'

export type Languages = {
	[key: string]: Language
}

export type Language = {
	short: string
	name: string
}

export const languages: Languages = {
	en: {short: 'en', name: 'English'}
}

export class SubtitleConverter {
	async convert(inputFile: string, outputFile: string, lang: Language) {
		const tmpFile = `/tmp/subtitles-${lang.short}.vtt`

		await new Promise((resolve, reject) => {
			ffmpeg(inputFile)
				.output(tmpFile)
				.on('start', (commandLine) => {
					console.log('FFmpeg command: ', commandLine)
				})
				.on('progress', (progress) => {
					console.log('progress: ', progress)
				})
				.on('error', (err) => {
					console.error(err)
					reject(err)
				})
				.on('end', () => {
					resolve(true)
				})
				.run()
		})

		await new Promise((resolve, reject) => {
			mp4box()
				.addOption('-add', `${tmpFile}:lang=${lang.short}:name="${lang.name}"`)
				.addOption('-new')
				.addOption(outputFile)
				.on('start', (commandLine) => {})
				.on('progress', (progress) => {
					console.log('progress: ', progress)
				})
				.on('error', (err) => {
					console.error(err)
					reject(err)
				})
				.on('end', () => {
					resolve(true)
				})
				.run()
		})
	}
}
