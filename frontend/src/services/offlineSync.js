// frontend/src/services/offlineSync.js

const QUEUE_KEY = 'offline_action_queue';
const TASKS_CACHE_KEY = 'offline_tasks_cache_';

// ലോക്കലായി ടാസ്ക്കുകൾ സേവ് ചെയ്യാൻ
export const saveTasksLocally = (boardId, tasksList) => {
    if (!boardId) return;
    localStorage.setItem(`${TASKS_CACHE_KEY}${boardId}`, JSON.stringify(tasksList));
};

// ഓഫ്‌ലൈൻ ആകുമ്പോൾ ടാസ്ക്കുകൾ കാണിക്കാൻ
export const getLocalTasks = (boardId) => {
    try {
        const data = localStorage.getItem(`${TASKS_CACHE_KEY}${boardId}`);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// ഓഫ്‌ലൈൻ സമയത്ത് ചെയ്യുന്ന മാറ്റങ്ങൾ (Add, Edit, Delete) ക്യൂവിൽ സേവ് ചെയ്യാൻ
export const saveOfflineAction = (action) => {
    try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue.push(action);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error('Failed to save offline action', e);
    }
};

// ഓൺലൈൻ ആകുമ്പോൾ മാറ്റങ്ങൾ ബാക്കെൻഡിലേക്ക് അയക്കാൻ
export const syncOfflineActions = async (tasksApi) => {
    try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (!queue.length) return;

        for (const action of queue) {
            try {
                if (action.type === 'CREATE_TASK') {
                    await tasksApi.create(action.payload);
                } else if (action.type === 'UPDATE_TASK') {
                    // താൽക്കാലികമായി ഉണ്ടാക്കിയ ഐഡി അല്ലാത്തവ മാത്രം അപ്ഡേറ്റ് ചെയ്യുക 
                    if (!String(action.taskId).startsWith('temp_')) {
                        await tasksApi.update(action.taskId, action.payload);
                    }
                } else if (action.type === 'DELETE_TASK') {
                    if (!String(action.taskId).startsWith('temp_')) {
                        await tasksApi.delete(action.taskId);
                    }
                }
            } catch (err) {
                console.error('Sync failed for action:', action, err);
            }
        }
        // സിങ്ക് പൂർത്തിയായാൽ ക്യൂ ക്ലിയർ ചെയ്യുക 
        localStorage.removeItem(QUEUE_KEY);
    } catch (e) {
        console.error('Failed to process offline sync queue', e);
    }
};