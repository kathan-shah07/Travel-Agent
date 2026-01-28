import { ConversationState } from '../types';
import { PreferenceManager } from './preference-manager';

export function createInitialState(): ConversationState {
    return {
        status: 'collecting_preferences',
        clarification_count: 0,
        preferences: PreferenceManager.getInitialPreferences(),
        itinerary_version: 1,
        history: [],
    };
}
