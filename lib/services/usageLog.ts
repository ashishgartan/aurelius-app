// lib/services/usageLog.ts
import { connectDB } from "@/lib/mongodb"
import { UsageLog } from "@/lib/models/UsageLog"
import { Types } from "mongoose"
import { estimateCost } from "@/lib/services/usageCost"

export async function logUsage(entry: {
  userId:       string
  sessionId:    string
  model:        string
  inputTokens:  number
  outputTokens: number
  toolCalls:    string[]
}) {
  await connectDB()
  await UsageLog.create({
    userId:       new Types.ObjectId(entry.userId),
    sessionId:    new Types.ObjectId(entry.sessionId),
    model:        entry.model,
    inputTokens:  entry.inputTokens,
    outputTokens: entry.outputTokens,
    toolCalls:    entry.toolCalls,
  })
}

export interface DailyStats {
  date:         string   // "YYYY-MM-DD"
  messages:     number
  inputTokens:  number
  outputTokens: number
  cost:         number
  toolCalls:    number
}

export interface UsageSummary {
  daily:          DailyStats[]
  totals: {
    messages:     number
    inputTokens:  number
    outputTokens: number
    cost:         number
    toolCalls:    number
  }
  modelBreakdown: { model: string; messages: number; cost: number }[]
  sessionBreakdown: {
    sessionId: string
    title: string
    messages: number
    cost: number
  }[]
}

export async function getUsageSummary(
  userId:  string,
  days:    number   // 7 or 30
): Promise<UsageSummary> {
  await connectDB()

  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const uid = new Types.ObjectId(userId)

  // ── Daily aggregation ─────────────────────────────────────────────
  const dailyRaw = await UsageLog.aggregate([
    { $match: { userId: uid, createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        messages:     { $sum: 1 },
        inputTokens:  { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        toolCalls:    { $sum: { $size: "$toolCalls" } },
        // Collect model+token pairs for cost calculation
        entries: {
          $push: {
            model:        "$model",
            inputTokens:  "$inputTokens",
            outputTokens: "$outputTokens",
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ])

  // Fill in missing days with zeros so the chart always has a full range
  const dailyMap = new Map<string, DailyStats>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { date: key, messages: 0, inputTokens: 0, outputTokens: 0, cost: 0, toolCalls: 0 })
  }

  for (const row of dailyRaw) {
    const cost = (row.entries as { model: string; inputTokens: number; outputTokens: number }[])
      .reduce((sum, e) => sum + estimateCost(e.model, e.inputTokens, e.outputTokens), 0)

    dailyMap.set(row._id, {
      date:         row._id,
      messages:     row.messages,
      inputTokens:  row.inputTokens,
      outputTokens: row.outputTokens,
      cost:         Math.round(cost * 1_000_000) / 1_000_000,
      toolCalls:    row.toolCalls,
    })
  }

  const daily = Array.from(dailyMap.values())

  // ── Model breakdown ───────────────────────────────────────────────
  const modelRaw = await UsageLog.aggregate([
    { $match: { userId: uid, createdAt: { $gte: since } } },
    {
      $group: {
        _id:          "$model",
        messages:     { $sum: 1 },
        inputTokens:  { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
      },
    },
    { $sort: { messages: -1 } },
  ])

  const modelBreakdown = modelRaw.map((r) => ({
    model:    r._id as string,
    messages: r.messages as number,
    cost:     Math.round(estimateCost(r._id, r.inputTokens, r.outputTokens) * 1_000_000) / 1_000_000,
  }))

  const sessionRaw = await UsageLog.aggregate([
    { $match: { userId: uid, createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$sessionId",
        messages: { $sum: 1 },
        inputTokens: { $sum: "$inputTokens" },
        outputTokens: { $sum: "$outputTokens" },
        modelEntries: {
          $push: {
            model: "$model",
            inputTokens: "$inputTokens",
            outputTokens: "$outputTokens",
          },
        },
      },
    },
    {
      $lookup: {
        from: "chatsessions",
        localField: "_id",
        foreignField: "_id",
        as: "session",
      },
    },
    { $sort: { messages: -1 } },
  ])

  const sessionBreakdown = sessionRaw.map((row) => {
    const cost = (row.modelEntries as { model: string; inputTokens: number; outputTokens: number }[])
      .reduce((sum, entry) => sum + estimateCost(entry.model, entry.inputTokens, entry.outputTokens), 0)
    const session = (row.session as Array<{ title?: string }> | undefined)?.[0]
    return {
      sessionId: row._id.toString(),
      title: session?.title?.trim() || "Untitled chat",
      messages: row.messages as number,
      cost: Math.round(cost * 1_000_000) / 1_000_000,
    }
  })

  // ── Totals ────────────────────────────────────────────────────────
  const totals = daily.reduce(
    (acc, d) => ({
      messages:     acc.messages     + d.messages,
      inputTokens:  acc.inputTokens  + d.inputTokens,
      outputTokens: acc.outputTokens + d.outputTokens,
      cost:         acc.cost         + d.cost,
      toolCalls:    acc.toolCalls    + d.toolCalls,
    }),
    { messages: 0, inputTokens: 0, outputTokens: 0, cost: 0, toolCalls: 0 }
  )
  totals.cost = Math.round(totals.cost * 1_000_000) / 1_000_000

  return { daily, totals, modelBreakdown, sessionBreakdown }
}
