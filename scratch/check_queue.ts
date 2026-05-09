import { db } from './src/db/dexie';

async function checkQueue() {
    const queue = await db.sync_queue.toArray();
    console.log('Sync Queue Length:', queue.length);
    queue.forEach(job => {
        console.log(`Job ${job.id}: ${job.operation} ${job.table_name} (Retries: ${job.retry_count})`);
        if (job.retry_count > 0) {
            console.log('Payload Snippet:', JSON.stringify(job.payload).slice(0, 100));
        }
    });
}

checkQueue();
