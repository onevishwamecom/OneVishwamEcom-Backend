# MongoDB Atlas Live Connection Guide: OneVishwam Backend

The live **`onevishwam`** MongoDB Atlas cluster is fully connected and operational!

---

## Live Configuration Summary
* **Atlas Cluster Host:** `onevishwam.372aojy.mongodb.net`
* **Replica Set Host:** `ac-vtlpw2s-shard-00-01.372aojy.mongodb.net`
* **Database Name:** `onevishwam`
* **Database User:** `onevishwamecom_db_user`
* **Status:** 🟢 **CONNECTED & LIVE**

---

## Active Environment Variable (`OneVishwamEcom-Backend/.env`)
```env
MONGODB_URI=mongodb+srv://onevishwamecom_db_user:<password>@onevishwam.372aojy.mongodb.net/onevishwam?retryWrites=true&w=majority
```

---

## Connection Resilience & Pooling (`config/db.js`)
* **`minPoolSize: 0`**: Prevents Atlas serverless/shared tiers from dropping or rejecting idle sockets.
* **`maxIdleTimeMS: 30000`**: Closes sockets idle for >30s cleanly before the cloud provider terminates them.
* **`serverSelectionTimeoutMS: 15000`**: Prevents hanging on initial connection.
* **Local Fallback**: Automatically connects to local MongoDB (`mongodb://127.0.0.1:27017/onevishwam`) if network is offline during local dev.

---

## How to Verify
Run the server:
```bash
cd d:\onevishwam\OneVishwamEcom-Backend
npm run dev
```

Console Output:
```text
Server running on port 5001
[DATABASE] MongoDB Atlas connected successfully: ac-vtlpw2s-shard-00-01.372aojy.mongodb.net
```
