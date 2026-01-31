
import { PreferenceManager } from '../src/preference-manager/PreferenceManager';
import { UserPreferences } from '../src/types';

describe('PreferenceManager', () => {
    let prefManager: PreferenceManager;

    beforeEach(() => {
        prefManager = new PreferenceManager();
    });

    test('getInitialPreferences should return default state', () => {
        const prefs = prefManager.getInitialPreferences();
        expect(prefs.city).toBe('');
        expect(prefs.trip_days).toBe(0);
        expect(prefs.confirmed).toBe(false);
        expect(prefs.constraints.mobility).toBe('normal');
    });

    test('getMissingFields should identify empty fields', () => {
        const prefs = prefManager.getInitialPreferences();
        const missing = prefManager.getMissingFields(prefs);
        expect(missing).toContain('city');
        expect(missing).toContain('trip_days');
        expect(missing).toContain('daily_time_window');
        expect(missing).toContain('interests');
    });

    test('getMissingFields should return empty if all fields set', () => {
        const prefs: UserPreferences = {
            city: 'Bangalore',
            trip_days: 3,
            daily_time_window: '09:00-18:00',
            interests: ['food'],
            pace: 'moderate',
            constraints: { indoor_preference: false, mobility: 'normal', weather_sensitive: true },
            confirmed: false
        };
        const missing = prefManager.getMissingFields(prefs);
        expect(missing.length).toBe(0);
    });
});
