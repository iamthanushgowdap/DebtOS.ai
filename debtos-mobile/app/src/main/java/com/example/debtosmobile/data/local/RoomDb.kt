package com.example.debtosmobile.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

// ─── Entities ─────────────────────────────────────────────────────────────────

@Entity(tableName = "pending_expenses")
data class PendingExpense(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: String,
    val category: String,
    val amount: Double,
    val entryDate: String,
    val description: String?,
    val creditCardId: String?,
    val pendingSync: Boolean = true
)

@Entity(tableName = "pending_income")
data class PendingIncome(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val userId: String,
    val source: String,
    val expectedAmount: Double,
    val receivedAmount: Double,
    val status: String,
    val entryDate: String,
    val pendingSync: Boolean = true
)

@Entity(tableName = "cached_loans")
data class CachedLoan(
    @PrimaryKey val id: String,
    val name: String,
    val lender: String,
    val emi: Double,
    val dueDay: Int,
    val currentBalance: Double,
    val interestRate: Double,
    val status: String,
    val priority: String
)

@Entity(tableName = "cached_cards")
data class CachedCard(
    @PrimaryKey val id: String,
    val cardName: String,
    val bank: String,
    val creditLimit: Double,
    val currentUtilization: Double,
    val minimumDue: Double,
    val statementDate: Int,
    val dueDate: Int,
    val status: String
)

// ─── DAOs ─────────────────────────────────────────────────────────────────────

@Dao
interface PendingExpenseDao {
    @Insert suspend fun insert(item: PendingExpense): Long
    @Query("SELECT * FROM pending_expenses WHERE pendingSync = 1") fun getPending(): Flow<List<PendingExpense>>
    @Query("DELETE FROM pending_expenses WHERE id = :id") suspend fun delete(id: Long)
    @Query("DELETE FROM pending_expenses") suspend fun clearAll()
}

@Dao
interface PendingIncomeDao {
    @Insert suspend fun insert(item: PendingIncome): Long
    @Query("SELECT * FROM pending_income WHERE pendingSync = 1") fun getPending(): Flow<List<PendingIncome>>
    @Query("DELETE FROM pending_income WHERE id = :id") suspend fun delete(id: Long)
    @Query("DELETE FROM pending_income") suspend fun clearAll()
}

@Dao
interface CachedLoanDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(items: List<CachedLoan>)
    @Query("SELECT * FROM cached_loans WHERE status = 'active'") fun getAll(): Flow<List<CachedLoan>>
    @Query("DELETE FROM cached_loans") suspend fun clearAll()
}

@Dao
interface CachedCardDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertAll(items: List<CachedCard>)
    @Query("SELECT * FROM cached_cards WHERE status = 'active'") fun getAll(): Flow<List<CachedCard>>
    @Query("DELETE FROM cached_cards") suspend fun clearAll()
}

// ─── Database ─────────────────────────────────────────────────────────────────

@Database(
    entities = [PendingExpense::class, PendingIncome::class, CachedLoan::class, CachedCard::class],
    version = 1,
    exportSchema = false
)
abstract class DebtOSDatabase : RoomDatabase() {
    abstract fun pendingExpenseDao(): PendingExpenseDao
    abstract fun pendingIncomeDao(): PendingIncomeDao
    abstract fun cachedLoanDao(): CachedLoanDao
    abstract fun cachedCardDao(): CachedCardDao

    companion object {
        @Volatile private var INSTANCE: DebtOSDatabase? = null

        fun getInstance(context: android.content.Context): DebtOSDatabase =
            INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(context, DebtOSDatabase::class.java, "debtos_db")
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
    }
}
