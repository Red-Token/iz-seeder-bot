const url = 'https://api.opensubtitles.com/api/v1/subtitles?imdb_id=tt1835736&languages=en';
const options = {
    method: 'GET',
    headers: {'User-Agent': '', 'Api-Key': 'AC4yKqlvJqVYFgQxv757DDP8A6qvvMvF'}
};

try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log(data);
} catch (error) {
    console.error(error);
}
