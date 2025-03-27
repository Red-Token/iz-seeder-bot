import {promisify} from 'node:util'
import fs from 'node:fs'

const apiKey = 'AC4yKqlvJqVYFgQxv757DDP8A6qvvMvF'
const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJBNmJ1QVdpangxMVA3U21HNGJ6cUJsU3JmWlBvNlVSUiIsImV4cCI6MTc0MjgwNTgxOH0.UwhtqvemW4zUALUSuCjkjTJSVr16X-2F5Rwnqu-jAjs'
const userAgent = 'MyApp v1.0'

export async function search(imdb_id: string, lang: string) {
    const url = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdb_id}&languages=${lang}`

    const options = {
        headers: {
            'Api-Key': apiKey,
            'User-Agent': userAgent
        }
    }

    return call(url, options)
}

export type DownloadRequestData = {
    file_id: number,
    sub_format?: string,
    file_name?: string,
    in_fps?: number,
    out_fps?: number,
    timeshift?: number,
    force_download?: boolean,
}

export async function download(data: DownloadRequestData) {
    const url = 'https://api.opensubtitles.com/api/v1/download'

    const options = {
        method: 'POST',
        headers: {
            'Api-Key': apiKey,
            'Authorization': `Bearer ` + token,
            'Content-Type': 'application/json',
            'User-Agent': userAgent
        },
        body: JSON.stringify(data)
    }

    return call(url, options)
}

async function call(url: any, options: any) {
    return await new Promise((resolve, reject) => {
        fetch(url, options).then(res => {
            if (res.ok) res.json().then(res => {
                resolve(res)
            }).catch(err => {
                console.log(err)
                reject(err)
            })

            console.log(res.statusText)
        }).catch(err => {
            console.log(err)
            reject(err)
        })
    })
}

// Promisify fs.writeFile for easier use with async/await
const writeFile = promisify(fs.writeFile);

export async function fetchAndSave(url: string, filePath: string) {
    try {
        // Fetch the data from the URL
        const response: Response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Get the data as a buffer (for binary data) or text (for text data)
        const data = await response.text(); // Use .text() for text data

        // Save the data to a file
        await writeFile(filePath, data);
        console.log(`Data saved to ${filePath}`);
    } catch (error) {
        console.error('Error:', error);
    }
}

