# MongoDB Atlas Live Connection Guide: Vishwam Backend

The live **`onevishwam`** MongoDB Atlas cluster is fully connected and operational!

---

## Live Configuration Summary
* **Atlas Cluster Host:** `onevishwam.372aojy.mongodb.net`
* **Replica Set Host:** `ac-vtlpw2s-shard-00-01.372aojy.mongodb.net`
* **Database Name:** `onevishwam`
* **Database User:** `onevishwamecom_db_user`
* **Status:** 🟢 **CONNECTED & LIVE**

---

## Active Environment Variable (`Vishwam-Backend/.env`)
```env
MONGODB_URI=mongodb+srv://onevishwamecom_db_user:VishwamPass123@onevishwam.372aojy.mongodb.net/onevishwam?retryWrites=true&w=majority
```

---

## How to Verify
Run the dev server in backend:
```bash
cd "/Users/tejas/Projects/Learn/React JS/Vishwam-Backend"
npm run dev
```

Console Output:
```text
Server running on port 5001
[DATABASE] MongoDB Atlas connected successfully: ac-vtlpw2s-shard-00-01.372aojy.mongodb.net
```
