import { TripPreferences, City, Pace } from '../types';

export class PreferenceManager {
    private static VALID_CITIES: City[] = ['Jaipur', 'Bengaluru', 'Goa'];
    private static VALID_PACES: Pace[] = ['relaxed', 'balanced', 'packed'];

    static getInitialPreferences(): TripPreferences {
        return {
            interests: [],
            constraints: {
                avoid_long_travel: false,
                indoor_preferred: false,
            },
        };
    }

    static validate(prefs: TripPreferences): { valid: boolean; missing: string[] } {
        const missing: string[] = [];
        if (!prefs.city || !this.VALID_CITIES.includes(prefs.city)) missing.push('city');
        if (!prefs.trip_days || prefs.trip_days < 1 || prefs.trip_days > 3) missing.push('trip_days');
        if (!prefs.pace || !this.VALID_PACES.includes(prefs.pace)) missing.push('pace');
        if (!prefs.interests || prefs.interests.length === 0) missing.push('interests');

        return {
            valid: missing.length === 0,
            missing,
        };
    }

    static isCitySupported(city: string): city is City {
        return this.VALID_CITIES.includes(city as City);
    }
}
