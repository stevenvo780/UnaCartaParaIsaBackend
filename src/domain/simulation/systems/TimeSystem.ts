import { EventEmitter } from "node:events";
import type { GameState } from "../../types/game-types.js";

export interface TimeOfDay {
  hour: number;
  minute: number;
  phase:
    | "dawn"
    | "morning"
    | "midday"
    | "afternoon"
    | "dusk"
    | "night"
    | "deep_night";
  lightLevel: number;
  temperature: number;
  timestamp: number;
}

export interface WeatherCondition {
  type: "clear" | "cloudy" | "rainy" | "stormy" | "foggy" | "snowy";
  intensity: number;
  visibility: number;
  comfort: number;
  duration: number;
}

interface TimeConfig {
  minutesPerGameHour: number;
  startHour: number;
  startMinute: number;
  weatherChangeIntervalMs: number;
  weatherDurationMin: number;
  weatherDurationMax: number;
}

const DEFAULT_CONFIG: TimeConfig = {
  minutesPerGameHour: 2,
  startHour: 6,
  startMinute: 0,
  weatherChangeIntervalMs: 300000, // 5 minutes
  weatherDurationMin: 180000, // 3 minutes
  weatherDurationMax: 900000, // 15 minutes
};

export class TimeSystem extends EventEmitter {
  private gameState: GameState;
  private config: TimeConfig;
  private currentTime: TimeOfDay;
  private currentWeather: WeatherCondition;
  private lastTimeUpdate = 0;
  private lastWeatherChange = 0;
  private readonly TIME_UPDATE_INTERVAL = 1000;

  constructor(gameState: GameState, config?: Partial<TimeConfig>) {
    super();
    this.gameState = gameState;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentTime = this.createInitialTime();
    this.currentWeather = this.createInitialWeather();
    this.lastTimeUpdate = Date.now();
    this.lastWeatherChange = Date.now();
  }

  public update(_deltaMs: number): void {
    // deltaMs parameter kept for API compatibility
    void _deltaMs;
    void _deltaMs;
    const now = Date.now();

    if (now - this.lastTimeUpdate >= this.TIME_UPDATE_INTERVAL) {
      this.updateTime();
      this.lastTimeUpdate = now;
    }

    if (
      now - this.lastWeatherChange >= this.config.weatherChangeIntervalMs &&
      this.shouldChangeWeather()
    ) {
      this.updateWeather();
      this.lastWeatherChange = now;
    }
  }

  private createInitialTime(): TimeOfDay {
    return {
      hour: this.config.startHour,
      minute: this.config.startMinute,
      phase: this.getPhaseFromTime(this.config.startHour),
      lightLevel: this.calculateLightLevel(this.config.startHour),
      temperature: this.calculateTemperature(this.config.startHour, "clear"),
      timestamp: Date.now(),
    };
  }

  private createInitialWeather(): WeatherCondition {
    return {
      type: "clear",
      intensity: 0.2,
      visibility: 1.0,
      comfort: 0.8,
      duration: this.randomFloat(
        this.config.weatherDurationMin,
        this.config.weatherDurationMax,
      ),
    };
  }

  private updateTime(): void {
    const realMinutesPerGameMinute = this.config.minutesPerGameHour / 60;
    const realMillisPerGameMinute = realMinutesPerGameMinute * 60 * 1000;

    const timeSinceLastUpdate = Date.now() - this.currentTime.timestamp;
    const gameMinutesToAdd = Math.floor(
      timeSinceLastUpdate / realMillisPerGameMinute,
    );

    if (gameMinutesToAdd > 0) {
      this.currentTime.minute += gameMinutesToAdd;

      if (this.currentTime.minute >= 60) {
        const hoursToAdd = Math.floor(this.currentTime.minute / 60);
        this.currentTime.minute = this.currentTime.minute % 60;
        this.currentTime.hour = (this.currentTime.hour + hoursToAdd) % 24;
      }

      this.currentTime.phase = this.getPhaseFromTime(this.currentTime.hour);
      this.currentTime.lightLevel = this.calculateLightLevel(
        this.currentTime.hour,
      );
      this.currentTime.temperature = this.calculateTemperature(
        this.currentTime.hour,
        this.currentWeather.type,
      );
      this.currentTime.timestamp = Date.now();

      this.gameState.timeOfDay = this.currentTime.phase;
      if (this.gameState.weather) {
        this.gameState.weather.current = this.currentWeather.type;
        this.gameState.weather.temperature = this.currentTime.temperature;
        this.gameState.weather.visibility = this.currentWeather.visibility;
        this.gameState.weather.lastChange = Date.now();
        this.gameState.weather.duration = this.currentWeather.duration;
      }
    }
  }

  private getPhaseFromTime(hour: number): TimeOfDay["phase"] {
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 11) return "morning";
    if (hour >= 11 && hour < 15) return "midday";
    if (hour >= 15 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 21) return "dusk";
    if (hour >= 21 && hour < 23) return "night";
    return "deep_night";
  }

  private calculateLightLevel(hour: number): number {
    if (hour >= 6 && hour <= 18) {
      const dayProgress = (hour - 6) / 12;
      return Math.sin(dayProgress * Math.PI) * 0.8 + 0.2;
    } else {
      const nightHour = hour > 18 ? hour - 18 : hour + 6;
      return Math.max(0.05, 0.3 - (nightHour / 12) * 0.25);
    }
  }

  private calculateTemperature(
    hour: number,
    weatherType: WeatherCondition["type"],
  ): number {
    const baseTemp = 15 + Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 10;
    const weatherModifiers: Record<string, number> = {
      clear: 0,
      cloudy: -3,
      rainy: -5,
      stormy: -7,
      foggy: -2,
      snowy: -12,
    };

    return Math.round(baseTemp + (weatherModifiers[weatherType] || 0));
  }

  private shouldChangeWeather(): boolean {
    this.currentWeather.duration -= this.TIME_UPDATE_INTERVAL;
    return this.currentWeather.duration <= 0;
  }

  private updateWeather(): void {
    const weatherProbabilities = this.getWeatherProbabilities();

    let newWeatherType = this.currentWeather.type;
    const rand = Math.random();
    let cumulative = 0;

    for (const [weather, probability] of Object.entries(weatherProbabilities)) {
      cumulative += probability;
      if (rand <= cumulative) {
        newWeatherType = weather as WeatherCondition["type"];
        break;
      }
    }

    if (this.isAbruptWeatherChange(this.currentWeather.type, newWeatherType)) {
      newWeatherType = this.getTransitionWeather(
        this.currentWeather.type,
        newWeatherType,
      );
    }

    this.currentWeather = {
      type: newWeatherType,
      intensity: this.calculateWeatherIntensity(newWeatherType),
      visibility: this.calculateVisibility(newWeatherType),
      comfort: this.calculateComfort(
        newWeatherType,
        this.currentTime.temperature,
      ),
      duration: this.randomFloat(
        this.config.weatherDurationMin,
        this.config.weatherDurationMax,
      ),
    };
    this.currentTime.temperature = this.calculateTemperature(
      this.currentTime.hour,
      this.currentWeather.type,
    );

    // Update game state
    if (this.gameState.weather) {
      this.gameState.weather.current = this.currentWeather.type;
      this.gameState.weather.temperature = this.currentTime.temperature;
      this.gameState.weather.visibility = this.currentWeather.visibility;
      this.gameState.weather.lastChange = Date.now();
      this.gameState.weather.duration = this.currentWeather.duration;
    }
  }

  private getWeatherProbabilities(): Record<string, number> {
    const base: Record<string, number> = {
      clear: 0.4,
      cloudy: 0.3,
      rainy: 0.15,
      stormy: 0.05,
      foggy: 0.1,
    };

    if (
      this.currentTime.phase === "night" ||
      this.currentTime.phase === "deep_night"
    ) {
      base.rainy += 0.1;
      base.foggy += 0.1;
      base.clear -= 0.2;
    }

    return base;
  }

  private isAbruptWeatherChange(current: string, next: string): boolean {
    const abruptChanges = [
      ["clear", "stormy"],
      ["clear", "rainy"],
      ["stormy", "clear"],
    ];

    return abruptChanges.some(
      ([from, to]) =>
        (current === from && next === to) || (current === to && next === from),
    );
  }

  private getTransitionWeather(
    current: string,
    target: string,
  ): WeatherCondition["type"] {
    if (
      (current === "clear" && target === "stormy") ||
      (current === "stormy" && target === "clear")
    ) {
      return "cloudy";
    }
    if (
      (current === "clear" && target === "rainy") ||
      (current === "rainy" && target === "clear")
    ) {
      return "cloudy";
    }
    return target as WeatherCondition["type"];
  }

  private calculateWeatherIntensity(
    weatherType: WeatherCondition["type"],
  ): number {
    const intensities: Record<string, number> = {
      clear: 0.1,
      cloudy: 0.3,
      foggy: 0.4,
      rainy: 0.5 + Math.random() * 0.4,
      stormy: 0.7 + Math.random() * 0.3,
      snowy: 0.6 + Math.random() * 0.3,
    };

    return intensities[weatherType] || 0.5;
  }

  private calculateVisibility(weatherType: WeatherCondition["type"]): number {
    const baseVisibility: Record<string, number> = {
      clear: 1.0,
      cloudy: 0.9,
      rainy: 0.6,
      stormy: 0.4,
      foggy: 0.3,
      snowy: 0.5,
    };

    return (baseVisibility[weatherType] || 1.0) * this.currentTime.lightLevel;
  }

  private calculateComfort(
    weatherType: WeatherCondition["type"],
    temperature: number,
  ): number {
    let comfort = 0;
    if (temperature >= 18 && temperature <= 24) {
      comfort = 1.0;
    } else if (temperature >= 15 && temperature <= 28) {
      comfort = 0.7;
    } else if (temperature >= 10 && temperature <= 32) {
      comfort = 0.4;
    } else {
      comfort = 0.1;
    }

    const weatherComfort: Record<string, number> = {
      clear: 0,
      cloudy: -0.1,
      rainy: -0.4,
      stormy: -0.7,
      foggy: -0.2,
      snowy: -0.5,
    };

    return Math.max(
      -1,
      Math.min(1, comfort + (weatherComfort[weatherType] || 0)),
    );
  }

  private randomFloat(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  public getCurrentTime(): TimeOfDay {
    return { ...this.currentTime };
  }

  public getCurrentWeather(): WeatherCondition {
    return { ...this.currentWeather };
  }

  public getTimeString(): string {
    const h = this.currentTime.hour.toString().padStart(2, "0");
    const m = this.currentTime.minute.toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  public getCurrentTimeOfDay():
    | "morning"
    | "afternoon"
    | "evening"
    | "night"
    | "rest" {
    const hour = this.currentTime.hour;

    if (hour >= 7 && hour < 11) return "morning";
    if (hour >= 11 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 21) return "evening";
    return "night";
  }

  public setTime(hour: number, minute: number = 0): void {
    this.currentTime.hour = Math.max(0, Math.min(23, hour));
    this.currentTime.minute = Math.max(0, Math.min(59, minute));
    this.currentTime.phase = this.getPhaseFromTime(this.currentTime.hour);
    this.currentTime.lightLevel = this.calculateLightLevel(
      this.currentTime.hour,
    );
    this.currentTime.temperature = this.calculateTemperature(
      this.currentTime.hour,
      this.currentWeather.type,
    );
    this.currentTime.timestamp = Date.now();
  }

  public setWeather(weatherType: WeatherCondition["type"]): void {
    this.currentWeather.type = weatherType;
    this.currentWeather.intensity = this.calculateWeatherIntensity(weatherType);
    this.currentWeather.visibility = this.calculateVisibility(weatherType);
    this.currentWeather.comfort = this.calculateComfort(
      weatherType,
      this.currentTime.temperature,
    );
    this.currentWeather.duration = this.config.weatherDurationMin;

    this.currentTime.temperature = this.calculateTemperature(
      this.currentTime.hour,
      weatherType,
    );
  }

  public getStats(): Record<string, unknown> {
    return {
      time: this.getTimeString(),
      phase: this.currentTime.phase,
      temperature: `${this.currentTime.temperature}°C`,
      weather: this.currentWeather.type,
      lightLevel: Math.round(this.currentTime.lightLevel * 100),
      visibility: Math.round(this.currentWeather.visibility * 100),
      comfort: Math.round(this.currentWeather.comfort * 100),
    };
  }
}
