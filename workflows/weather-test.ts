import { sleep } from "workflow";

export async function weatherTest(city: string, lat: number, lon: number) {
  "use workflow";
  const weather = await getWeather(lat, lon);
  console.log("Weather fetched for", city, weather);
  await sleep("5m"); // time to stop and restart the server
  console.log("Weather test finished for", city);
  return { city, ...weather, finishedAt: new Date().toISOString() };
}

async function getWeather(lat: number, lon: number) {
  "use step";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const data = await res.json();
  return { temperatureC: data.current.temperature_2m };
}