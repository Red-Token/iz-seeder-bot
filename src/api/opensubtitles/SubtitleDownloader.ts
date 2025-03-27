import {Language} from '../../util/SubtitleConverter.js'
import {download, DownloadRequestData, fetchAndSave, search} from './api.js'

export async function searchAndDownloadSubtitles(imdbId: string, lang: Language, downloadFile: string) {
    const searchResult: any = await search(imdbId, lang.short)

    console.log(searchResult)

    const data: DownloadRequestData = {
        file_id: searchResult.data[0].attributes.files[0].file_id
    }

    const downloadResult: any = await download(data)

    console.log(downloadResult)

    await fetchAndSave(downloadResult.link, downloadFile)

    console.log('THE END')
}


class SubtitleDownloader {

}
