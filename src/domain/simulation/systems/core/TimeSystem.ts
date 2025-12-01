import { EventEmitter } from "node:events";
import type { GameState } from "@/shared/types/game-types";
import { simulationEvents, GameEventType } from "../../core/events";
import { injectable, inject, unmanaged } from "inversify";
import { TYPES } from "../../../../config/Types";
import { TimeOfDayPhase } from "../../../../shared/constants/TimeEnums";
import { WeatherType } from "../../../../shared/constants/AmbientEnums";
import { WorkShift } from "../../../../shared/constants/RoleEnums";

export interface TimeOfDay {
  hour: number;
  minute: number;
  phase: TimeOfDayPhase;
  lightLevel: number;
  temperature: number;
  timestamp: number;
}

export interface WeatherCondition {
  type: WeatherType;
  intensity: number;
  visibility: number;
  comfort: number;
  duration: number;
}

export interface EnvironmentalEffects {
  needsMultipliers: {
    hunger: number;
    thirst: number;
    energy: number;
    mentalHealth: number;
  };
  movementSpeed: number;
  visionRange: number;
  socialMood: number;
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
  weatherChangeIntervalMs: 300000,
  weatherDurationMin: 180000,
  weatherDurationMax: 900000,
};

@injectable()
export class TimeSystem extends EventEmitter {
  @inject(TYPES.GameState)
  private gameState!: GameState;
  private config: TimeConfig;
  private currentTime: TimeOfDay;
  private currentWeather: WeatherCondition;
  private lastTimeUpdate = 0;
  private lastWeatherChange = 0;
  private readonly TIME_UPDATE_INTERVAL = 1000;

  constructor(@unmanaged() config?: Partial<TimeConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentTime = this.createInitialTime();
    this.currentWeather = this.createInitialWeather();
    this.lastTimeUpdate = Date.now();
    this.lastWeatherChange = Date.now();
  }

  public update(_deltaMs: number): void {
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
      temperature: this.calculateTemperature(
        this.config.startHour,
        WeatherType.CLEAR,
      ),
      timestamp: Date.now(),
    };
  }

  private createInitialWeather(): WeatherCondition {
    return {
      type: WeatherType.CLEAR,
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

      simulationEvents.emit(GameEventType.TIME_CHANGED, {
        time: { ...this.currentTime },
        timestamp: Date.now(),
      });
    }
  }

  private getPhaseFromTime(hour: number): TimeOfDayPhase {
    if (hour >= 5 && hour < 7) return TimeOfDayPhase.DAWN;
    if (hour >= 7 && hour < 11) return TimeOfDayPhase.MORNING;
    if (hour >= 11 && hour < 15) return TimeOfDayPhase.MIDDAY;
    if (hour >= 15 && hour < 18) return TimeOfDayPhase.AFTERNOON;
    if (hour >= 18 && hour < 21) return TimeOfDayPhase.DUSK;
    if (hour >= 21 && hour < 23) return TimeOfDayPhase.NIGHT;
    return TimeOfDayPhase.DEEP_NIGHT;
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

  private calculateTemperature(hour: number, weatherType: WeatherType): number {
    const baseTemp = 15 + Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 10;
    const weatherModifiers: Record<WeatherType, number> = {
      [WeatherType.CLEAR]: 0,
      [WeatherType.CLOUDY]: -3,
      [WeatherType.RAINY]: -5,
      [WeatherType.STORMY]: -7,
      [WeatherType.FOGGY]: -2,
      [WeatherType.SNOWY]: -12,
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
        newWeatherType = weather as WeatherType;
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

    if (this.gameState.weather) {
      this.gameState.weather.current = this.currentWeather.type;
      this.gameState.weather.temperature = this.currentTime.temperature;
      this.gameState.weather.visibility = this.currentWeather.visibility;
      this.gameState.weather.lastChange = Date.now();
      this.gameState.weather.duration = this.currentWeather.duration;
    }

    const effects = this.calculateEnvironmentalEffects();
    simulationEvents.emit(GameEventType.TIME_WEATHER_CHANGED, {
      weather: { ...this.currentWeather },
      time: { ...this.currentTime },
      effects,
      timestamp: Date.now(),
    });
  }

  private getWeatherProbabilities(): Record<WeatherType, number> {
    const base: Record<WeatherType, number> = {
      [WeatherType.CLEAR]: 0.4,
      [WeatherType.CLOUDY]: 0.3,
      [WeatherType.RAINY]: 0.15,
      [WeatherType.STORMY]: 0.05,
      [WeatherType.FOGGY]: 0.1,
      [WeatherType.SNOWY]: 0.0,
    };

    if (
      this.currentTime.phase === TimeOfDayPhase.NIGHT ||
      this.currentTime.phase === TimeOfDayPhase.DEEP_NIGHT
    ) {
      base[WeatherType.RAINY] += 0.1;
      base[WeatherType.FOGGY] += 0.1;
      base[WeatherType.CLEAR] -= 0.2;
    }

    return base;
  }

  private isAbruptWeatherChange(
    current: WeatherType,
    next: WeatherType,
  ): boolean {
    const abruptChanges: Array<[WeatherType, WeatherType]> = [
      [WeatherType.CLEAR, WeatherType.STORMY],
      [WeatherType.CLEAR, WeatherType.RAINY],
      [WeatherType.STORMY, WeatherType.CLEAR],
    ];

    return abruptChanges.some(
      ([from, to]) =>
        (current === from && next === to) || (current === to && next === from),
    );
  }

  private getTransitionWeather(
    current: WeatherType,
    target: WeatherType,
  ): WeatherType {
    if (
      (current === WeatherType.CLEAR && target === WeatherType.STORMY) ||
      (current === WeatherType.STORMY && target === WeatherType.CLEAR)
    ) {
      return WeatherType.CLOUDY;
    }
    if (
      (current === WeatherType.CLEAR && target === WeatherType.RAINY) ||
      (current === WeatherType.RAINY && target === WeatherType.CLEAR)
    ) {
      return WeatherType.CLOUDY;
    }
    return target;
  }

  private calculateWeatherIntensity(weatherType: WeatherType): number {
    const intensities: Record<WeatherType, number> = {
      [WeatherType.CLEAR]: 0.1,
      [WeatherType.CLOUDY]: 0.3,
      [WeatherType.FOGGY]: 0.4,
      [WeatherType.RAINY]: 0.5 + Math.random() * 0.4,
      [WeatherType.STORMY]: 0.7 + Math.random() * 0.3,
      [WeatherType.SNOWY]: 0.6 + Math.random() * 0.3,
    };

    return intensities[weatherType] || 0.5;
  }

  private calculateVisibility(weatherType: WeatherType): number {
    const baseVisibility: Record<WeatherType, number> = {
      [WeatherType.CLEAR]: 1.0,
      [WeatherType.CLOUDY]: 0.9,
      [WeatherType.RAINY]: 0.6,
      [WeatherType.STORMY]: 0.4,
      [WeatherType.FOGGY]: 0.3,
      [WeatherType.SNOWY]: 0.5,
    };

    return (baseVisibility[weatherType] || 1.0) * this.currentTime.lightLevel;
  }

  private calculateComfort(
    weatherType: WeatherType,
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

    const weatherComfort: Record<WeatherType, number> = {
      [WeatherType.CLEAR]: 0,
      [WeatherType.CLOUDY]: -0.1,
      [WeatherType.RAINY]: -0.4,
      [WeatherType.STORMY]: -0.7,
      [WeatherType.FOGGY]: -0.2,
      [WeatherType.SNOWY]: -0.5,
    };

    return Math.max(
      -1,
      Math.min(1, comfort + (weatherComfort[weatherType] || 0)),
    );
  }

  private calculateEnvironmentalEffects(): EnvironmentalEffects {
    const time = this.currentTime;
    const weather = this.currentWeather;

    const effects: EnvironmentalEffects = {
      needsMultipliers: {
        hunger: 1.0,
        thirst: 1.0,
        energy: 1.0,
        mentalHealth: 1.0,
      },
      movementSpeed: 1.0,
      visionRange: weather.visibility,
      socialMood: weather.comfort * 0.5,
    };
    if (
      time.phase === TimeOfDayPhase.NIGHT ||
      time.phase === TimeOfDayPhase.DEEP_NIGHT
    ) {
      effects.needsMultipliers.energy *= 1.3;
      effects.movementSpeed *= 0.9;
    } else if (time.phase === TimeOfDayPhase.MIDDAY) {
      effects.needsMultipliers.thirst *= 1.2;
    }
    if (
      weather.type === WeatherType.RAINY ||
      weather.type === WeatherType.STORMY
    ) {
      effects.needsMultipliers.mentalHealth *= 1.1;
      effects.movementSpeed *= 0.8;
    }

    if (
      weather.type === WeatherType.CLEAR &&
      time.phase === TimeOfDayPhase.MORNING
    ) {
      effects.needsMultipliers.mentalHealth *= 0.9;
      effects.socialMood += 0.2;
    }

    return effects;
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

  public getCurrentEffects(): EnvironmentalEffects {
    return this.calculateEnvironmentalEffects();
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

    if (hour >= 7 && hour < 11) return TimeOfDayPhase.MORNING;
    if (hour >= 11 && hour < 18) return TimeOfDayPhase.AFTERNOON;
    if (hour >= 18 && hour < 21) return WorkShift.EVENING;
    return TimeOfDayPhase.NIGHT;
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

  public setWeather(weatherType: WeatherType): void {
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
