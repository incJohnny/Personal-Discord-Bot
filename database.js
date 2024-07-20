const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize SQLite database
const dbPath = path.join(__dirname, 'debts.db');
const db = new sqlite3.Database(dbPath);

// Create the debts table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1 TEXT NOT NULL,
        user2 TEXT NOT NULL,
        amount REAL NOT NULL,
        UNIQUE(user1, user2)
    )`);
});

/**
 * Insert or update a debt record.
 * @param {string} user1 - ID of the user recording the debt.
 * @param {string} user2 - ID of the user who owes the debt.
 * @param {number} amount - Amount of debt.
 * @param {function} callback - Callback function to handle result or error.
 */
function addDebt(user1, user2, amount, callback) {
    db.run(`INSERT INTO debts (user1, user2, amount) VALUES (?, ?, ?) 
            ON CONFLICT(user1, user2) DO UPDATE SET amount = amount + ?`, 
        [user1, user2, amount, amount], 
        function(err) {
            callback(err);
        });
}

/**
 * Update an existing debt record.
 * @param {string} user1 - ID of the user recording the debt.
 * @param {string} user2 - ID of the user who owes the debt.
 * @param {number} amount - Amount of debt to add or subtract.
 * @param {function} callback - Callback function to handle result or error.
 */
function updateDebt(user1, user2, amount, callback) {
    db.get(`SELECT amount FROM debts WHERE user1 = ? AND user2 = ?`, [user1, user2], (err, row) => {
        if (err) {
            callback(err);
            return;
        }

        const currentDebt = row ? row.amount : 0;
        const newDebt = Math.max(0, currentDebt + amount);

        db.run(`INSERT INTO debts (user1, user2, amount) VALUES (?, ?, ?) 
                ON CONFLICT(user1, user2) DO UPDATE SET amount = ?`, 
            [user1, user2, newDebt, newDebt], 
            function(err) {
                callback(err);
            });
    });
}

/**
 * Retrieve the total debt amount for a given user.
 * @param {string} user1 - ID of the user who is checking the debts.
 * @param {string} user2 - ID of the user who owes money.
 * @param {function} callback - Callback function to handle result or error.
 */
function getDebt(user1, user2, callback) {
    db.get(`SELECT amount FROM debts WHERE user1 = ? AND user2 = ?`, 
        [user1, user2], 
        function(err, row) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, row ? row.amount : 0);
        });
}

/**
 * List all debts for a given user.
 * @param {string} user1 - ID of the user whose debts are being listed.
 * @param {function} callback - Callback function to handle result or error.
 */
function listDebts(user1, callback) {
    db.all(`SELECT user2, SUM(amount) as total FROM debts WHERE user1 = ? GROUP BY user2`, 
        [user1], 
        function(err, rows) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, rows);
        });
}
/**
 * Remove all debts where the specified user owes the given user.
 * @param {string} user1 - ID of the user who is owed money.
 * @param {string} user2 - ID of the user who owes money.
 * @param {function} callback - Callback function to handle result or error.
 */
function removeDebts(user1, user2, callback) {
    db.run(`DELETE FROM debts WHERE user1 = ? AND user2 = ?`, 
        [user1, user2], 
        function(err) {
            callback(err);
        });
}

/**
 * Delete all debt records.
 * @param {function} callback - Callback function to handle result or error.
 */
function clearDebts(callback) {
    db.run(`DELETE FROM debts`, function(err) {
        callback(err);
    });
}

module.exports = {
    addDebt,
    updateDebt,
    getDebt,
    listDebts,
    removeDebts,
    clearDebts
};
