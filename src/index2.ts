import {setDefaultResultOrder} from 'node:dns'
import * as dns from 'node:dns'
import {DownloadRequestData, download, search, fetchAndSave} from './api/opensubtitles/api.js'
import path from 'node:path'

// setDefaultResultOrder('ipv4first')
// dns.setServers(['8.8.8.8', '1.1.1.1']) // Google DNS and Cloudflare DNS

// async function callApi2(url: string, data: any) {
//     const apiKey = 'AC4yKqlvJqVYFgQxv757DDP8A6qvvMvF'
//     const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJBNmJ1QVdpangxMVA3U21HNGJ6cUJsU3JmWlBvNlVSUiIsImV4cCI6MTc0MjgwNTgxOH0.UwhtqvemW4zUALUSuCjkjTJSVr16X-2F5Rwnqu-jAjs'
//
//     const options = {
//         method: 'POST',
//         headers: {
//             'Api-Key': apiKey,
//             'Authorization': `Bearer ` + token,
//             'Content-Type': 'application/json',
//             'User-Agent': 'MyApp v1.0'
//         },
//         body: JSON.stringify(data)
//     }
//
//     return await new Promise((resolve, reject) => {
//         fetch(url, options).then(res => {
//             if (res.ok) res.json().then(res => {
//                 resolve(res)
//             })
//         }).catch(err => {
//             console.log(err)
//             // reject(err)
//         })
//     })
//
//     // throw new Error('Could not find info')
// }

// async function callApi(url: string) {
//     const apiKey = 'AC4yKqlvJqVYFgQxv757DDP8A6qvvMvF'
//
//     const options = {
//         headers: {
//             'Api-Key': apiKey,
//             'User-Agent': 'MyApp v1.0'
//         }
//     }
//
//     return await new Promise((resolve, reject) => {
//         fetch(url, options).then(res => {
//             if (res.ok) res.json().then(res => {
//                 resolve(res)
//             })
//         }).catch(err => {
//             console.log(err)
//             // reject(err)
//         })
//     })
//
//     // throw new Error('Could not find info')
// }

const res: any = await search('tt1835736', 'en')

console.log(res)

const data: DownloadRequestData = {
    file_id: res.data[0].attributes.files[0].file_id
}

const res2: any = await download(data)

console.log(res2)

await fetchAndSave(res2.link, path.join('/tmp/', res2.file_name))

console.log("THE END")

// callApi('https://api.opensubtitles.com/api/v1/subtitles?imdb_id=tt1835736&languages=en').then((res: any) => {
//         console.log(res)
//
//         const file_id = res.data[0].attributes.files[0].file_id
//
//         const data = {
//             file_id
//         }
//
//         callApi2('https://api.opensubtitles.com/api/v1/download', data).then(res => {
//             console.log(res)
//         })
//     }
// )

//https://www.opensubtitles.com/download/CC45751B345711D157BA82BDCA2379065D9C9EB994EFB2498355B7536D5CCA3D9D51618116D2440DFA8ABE2FA21A839E5CAB91758FF4FDDE677A02270DF71D83258F629461C2DD1273E8E22DE5CA3750DDDE632F2FE6831E6203898CEC6A9D5FC6A8FE14FBB8D61CDBBBAC472F2A66E8BE474803AA7EE884F244F42A86F503402D605584177D643398CC81F18DD8EC1FAD61B2DDB09991D9DB716677948619C8E0ACFD394FE27E0D90FC4468A7DD6A93411EB93EE7DC467729F8A17BA13F877566AB33C26AC62C234C9552EA502623703EABA6CD5C3B077E024CE071AFB976DE66DD39F85DB746C38F474FFE2F33DC54DBF4D844A47358E9BFB9543C03CD41A5FCA07F4A988500B0DD12A9AF1923786F5DF4866D2D9E2D745EDD686EB8914C0325EE6367F5E6AECD/subfile/The%20Borgias%20(2011)%20S01E06.en.srt

//"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJBNmJ1QVdpangxMVA3U21HNGJ6cUJsU3JmWlBvNlVSUiIsImV4cCI6MTc0MjgwNTgxOH0.UwhtqvemW4zUALUSuCjkjTJSVr16X-2F5Rwnqu-jAjs"
//eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJBNmJ1QVdpangxMVA3U21HNGJ6cUJsU3JmWlBvNlVSUiIsImV4cCI6MTc0MjgwNTgxOH0.UwhtqvemW4zUALUSuCjkjTJSVr16X-2F5Rwnqu-jAjs
// 9211371

// const data = {
//     file_id: 9211371
// }

// callApi2('https://api.opensubtitles.com/api/v1/download', data).then(res => {
//     console.log(res)
// })
