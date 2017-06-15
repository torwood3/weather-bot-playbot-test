const request = require('request');
const moment = require('moment');

const OPEN_WEATHER_MAP_API = process.env.OPEN_WEATHER_MAP_API;

export class WeatherService{
    constructor(){}

    get(time, location, lang, done) {
        const diff = -1 * moment().diff(time, 'days');
        let options = {method: 'GET'};

        if (diff => 0 && diff < 5 ) {
            options.url = `http://api.openweathermap.org/data/2.5/forecast/daily?q=${location}&cnt=5&units=metric&lang=
                ${lang}&appid=${OPEN_WEATHER_MAP_API}`
        } else {
            console.log("Time windows not handled");
            return done(null, 400);
        }

        request(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                body = JSON.parse(body);
                if (body.cnt >= diff) {
                    const result = body.list[diff];
                    if (result)
                        done({
                            "speech": `${result.weather[0].description} avec une température d'environ ${Math.floor(result.temp.day)}°C`,
                            "source": "weather-api-playbots-test",
                            "displayText": `${result.weather[0].description} avec une température d'environ ${Math.floor(result.temp.day)}°C`
                        });
                    else
                        return done(null, 400);
                }
            } else {
                console.error("Unable to get weather.");
                console.error(response);
                console.error(error);
                return done(null, 400);
            }
        });
    }
}