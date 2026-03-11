import * as fs from 'fs'
// import * as mpdParser from 'mpd-parser';
import {XMLBuilder, XMLParser} from 'fast-xml-parser'


export function patchMpd(patchFile: string) {
    const mpdXml = fs.readFileSync(patchFile, 'utf-8')

// Parse MPD XML into JSON
    const parser = new XMLParser({ignoreAttributes: false, attributeNamePrefix: ''})
    const mpdJson = parser.parse(mpdXml)

    if (mpdJson.MPD.ProgramInformation) {
        mpdJson.MPD.ProgramInformation = undefined
    }

// Add contentType="text" to AdaptationSets with mimeType application/mp4 or codecs wvtt
    if (mpdJson.MPD && mpdJson.MPD.Period && mpdJson.MPD.Period.AdaptationSet) {
        const sets = Array.isArray(mpdJson.MPD.Period.AdaptationSet)
            ? mpdJson.MPD.Period.AdaptationSet
            : [mpdJson.MPD.Period.AdaptationSet]

        sets.forEach((adaptationSet: any) => {

            const representation = adaptationSet.Representation
            if (
                (representation &&
                    ((representation.mimeType && representation.mimeType.includes('application/mp4')) ||
                        (representation.codecs && representation.codecs.includes('wvtt')))) ||
                adaptationSet.mimeType?.includes('application/mp4')
            ) {
                adaptationSet.contentType = 'text'
            }
        })
    }

// Convert JSON back to XML
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        format: true,
        suppressBooleanAttributes: false
    })
    const updatedMpdXml = builder.build(mpdJson)

// Save the updated MPD
    fs.writeFileSync(patchFile, updatedMpdXml)
    console.log('MPD updated with contentType="text" where needed.')
}
