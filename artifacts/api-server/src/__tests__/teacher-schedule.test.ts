import { beforeEach, describe, expect, it, vi } from "vitest";

type ScheduleRow = {
  id: number;
  teacherId: number;
  kind: "weekly" | "appointment" | "break";
  title: string;
  subject: string | null;
  className: string | null;
  color: string | null;
  dayOfWeek: number | null;
  lessonNumber: number | null;
  breakAfterLesson: number | null;
  appointmentDate: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Condition =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "and"; conditions: Condition[] };

const mockState = vi.hoisted(() => {
  const rows: ScheduleRow[] = [];
  let nextId = 1;

  function matches(row: ScheduleRow, condition?: Condition): boolean {
    if (!condition) return true;
    if (condition.kind === "eq") {
      return row[condition.column as keyof ScheduleRow] === condition.value;
    }
    return condition.conditions.every((nested) => matches(row, nested));
  }

  function makeQuery(query: Record<string, any>, execute: () => unknown) {
    Object.assign(query, {
      from: () => query,
      where: (condition: Condition) => {
        query.condition = condition;
        return query;
      },
      orderBy: (...orderings: Array<{ column: string; direction: "asc" }>) => {
        query.orderings = orderings;
        return query;
      },
      limit: (count: number) => {
        query.limitCount = count;
        return query;
      },
      values: (values: unknown) => {
        query.valuesData = values;
        return query;
      },
      set: (values: unknown) => {
        query.setData = values;
        return query;
      },
      returning: (projection?: Record<string, string>) => {
        query.projection = projection;
        return query;
      },
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(execute()).then(onFulfilled, onRejected),
    });
    return query;
  }

  function sortRows(
    input: ScheduleRow[],
    orderings: Array<{ column: string; direction: "asc" }>,
  ) {
    return [...input].sort((left, right) => {
      for (const ordering of orderings) {
        const leftValue = left[ordering.column as keyof ScheduleRow];
        const rightValue = right[ordering.column as keyof ScheduleRow];
        if (leftValue === rightValue) continue;
        if (leftValue == null) return -1;
        if (rightValue == null) return 1;
        return String(leftValue).localeCompare(String(rightValue));
      }
      return 0;
    });
  }

  function project(row: ScheduleRow, projection?: Record<string, string>) {
    if (!projection) return row;
    return Object.fromEntries(
      Object.entries(projection).map(([key, column]) => [
        key,
        row[column as keyof ScheduleRow],
      ]),
    );
  }

  const table = {
    id: "id",
    teacherId: "teacherId",
    appointmentDate: "appointmentDate",
    dayOfWeek: "dayOfWeek",
    startTime: "startTime",
  };

  const db = {
    select: () => {
      const query: Record<string, any> = {};
      Object.assign(
        query,
        makeQuery(query, () => {
          let selected = rows.filter((row) => matches(row, query.condition));
          selected = sortRows(selected, query.orderings || []);
          if (query.limitCount != null)
            selected = selected.slice(0, query.limitCount);
          return selected;
        }),
      );
      return query;
    },
    insert: () => {
      const query: Record<string, any> = {};
      Object.assign(
        query,
        makeQuery(query, () => {
          const values = Array.isArray(query.valuesData)
            ? query.valuesData
            : [query.valuesData];
          const created = values.map((value) => {
            const now = new Date();
            const row = {
              ...value,
              id: nextId++,
              createdAt: now,
              updatedAt: now,
            } as ScheduleRow;
            rows.push(row);
            return row;
          });
          return created.map((row) => project(row, query.projection));
        }),
      );
      return query;
    },
    update: () => {
      const query: Record<string, any> = {};
      Object.assign(
        query,
        makeQuery(query, () => {
          const updated = rows
            .filter((row) => matches(row, query.condition))
            .map((row) => Object.assign(row, query.setData));
          return updated.map((row) => project(row, query.projection));
        }),
      );
      return query;
    },
    delete: () => {
      const query: Record<string, any> = {};
      Object.assign(
        query,
        makeQuery(query, () => {
          const deleted = rows.filter((row) => matches(row, query.condition));
          for (const row of deleted) rows.splice(rows.indexOf(row), 1);
          return deleted.map((row) => project(row, query.projection));
        }),
      );
      return query;
    },
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };

  return {
    rows,
    table,
    db,
    async rawQuery(sql: string, params: any[] = []) {
      if (sql.includes("SELECT id FROM teacher_schedule")) {
        return { rows: rows.filter((row) => row.teacherId === params[0] && row.id === params[1]).map((row) => ({ id: row.id })) };
      }
      if (sql.includes("UPDATE teacher_schedule SET")) {
        const row = rows.find((candidate) => candidate.teacherId === params[0] && candidate.id === params[1]);
        if (!row) return { rows: [] };
        Object.assign(row, {
          kind: params[2], title: params[3], subject: params[4], className: params[5],
          color: params[6], dayOfWeek: params[7], lessonNumber: params[8],
          breakAfterLesson: params[9], appointmentDate: params[10], startTime: params[11],
          endTime: params[12], location: params[13], notes: params[14], updatedAt: new Date(),
        });
        return { rows: [{
          id: row.id, teacher_id: row.teacherId, kind: row.kind, title: row.title,
          subject: row.subject, class_name: row.className, color: row.color,
          day_of_week: row.dayOfWeek, lesson_number: row.lessonNumber,
          break_after_lesson: row.breakAfterLesson, appointment_date: row.appointmentDate,
          start_time: row.startTime, end_time: row.endTime, location: row.location,
          notes: row.notes, created_at: row.createdAt, updated_at: row.updatedAt,
        }] };
      }
      if (sql.includes("DELETE FROM teacher_schedule WHERE")) {
        const index = rows.findIndex((row) => row.teacherId === params[0] && row.id === params[1]);
        if (index >= 0) rows.splice(index, 1);
      }
      return { rows: [] };
    },
    reset() {
      rows.length = 0;
      nextId = 1;
    },
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...conditions: Condition[]) => ({ kind: "and", conditions }),
  asc: (column: string) => ({ column, direction: "asc" }),
  eq: (column: string, value: unknown) => ({ kind: "eq", column, value }),
}));

vi.mock("@workspace/db", () => ({
  db: mockState.db,
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({
      query: mockState.rawQuery,
      release: vi.fn(),
    }),
  },
  teacherScheduleTable: mockState.table,
}));

import express from "express";
import request from "supertest";
import router from "../routes/teacher-schedule";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    next();
  });
  app.use("/api", router);
  return app;
}

const lesson = (title: string, lessonNumber: number, startTime: string) => ({
  kind: "weekly" as const,
  title,
  subject: "رياضيات",
  className: "الرابع",
  color: null,
  dayOfWeek: 1,
  lessonNumber,
  breakAfterLesson: null,
  appointmentDate: null,
  startTime,
  endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
  location: null,
  notes: null,
});

const breakEntry = (title = "استراحة") => ({
  kind: "break" as const,
  title,
  subject: null,
  className: null,
  color: null,
  dayOfWeek: 1,
  lessonNumber: null,
  breakAfterLesson: 2,
  appointmentDate: null,
  startTime: "09:30",
  endTime: "09:45",
  location: null,
  notes: null,
});

beforeEach(() => {
  mockState.reset();
});

describe("teacher schedule breaks", () => {
  it("requires an authenticated teacher session", async () => {
    const response = await request(makeApp(null)).get("/api/teacher/schedule");

    expect(response.status).toBe(401);
  });

  it("persists a valid lesson color through create, update, and reload", async () => {
    const app = makeApp({ teacherId: 101 });

    const created = await request(app)
      .post("/api/teacher/schedule")
      .send({ ...lesson("رياضيات", 1, "08:00"), color: "#2563EB" })
      .expect(201);
    expect(created.body.color).toBe("#2563EB");

    const updated = await request(app)
      .patch(`/api/teacher/schedule/${created.body.id}`)
      .send({ color: "#E11D48" })
      .expect(200);
    expect(updated.body.color).toBe("#E11D48");

    const reread = await request(app).get("/api/teacher/schedule").expect(200);
    expect(reread.body[0].color).toBe("#E11D48");

    await request(app)
      .post("/api/teacher/schedule")
      .send({ ...lesson("لون غير صالح", 2, "10:00"), color: "red" })
      .expect(400);
  });

  it("deletes the current teacher's whole schedule without touching another teacher", async () => {
    const teacherOne = makeApp({ teacherId: 101 });
    const teacherTwo = makeApp({ teacherId: 202 });

    await request(teacherOne).post("/api/teacher/schedule").send(lesson("رياضيات", 1, "08:00")).expect(201);
    await request(teacherOne).post("/api/teacher/schedule").send({
      ...lesson("موعد", 1, "12:00"),
      kind: "appointment",
      dayOfWeek: null,
      lessonNumber: null,
      appointmentDate: "2026-09-12",
      subject: null,
      className: null,
    }).expect(201);
    await request(teacherTwo).post("/api/teacher/schedule").send(lesson("علوم", 1, "08:00")).expect(201);

    const response = await request(teacherOne).delete("/api/teacher/schedule").expect(200);
    expect(response.body).toEqual({ deletedCount: 2 });
    expect((await request(teacherOne).get("/api/teacher/schedule").expect(200)).body).toEqual([]);
    expect((await request(teacherTwo).get("/api/teacher/schedule").expect(200)).body).toHaveLength(1);
  });

  it("creates, orders, reads, updates, and deletes a break for its owner", async () => {
    const app = makeApp({ teacherId: 101 });

    await request(app)
      .post("/api/teacher/schedule")
      .send(lesson("الحصة الأولى", 1, "08:00"))
      .expect(201);
    await request(app)
      .post("/api/teacher/schedule")
      .send({ ...lesson("الحصة الثانية", 2, "09:00"), endTime: "09:30" })
      .expect(201);
    const createdBreak = await request(app)
      .post("/api/teacher/schedule")
      .send(breakEntry())
      .expect(201);
    await request(app)
      .post("/api/teacher/schedule")
      .send(lesson("الحصة الثالثة", 3, "10:00"))
      .expect(201);

    expect(createdBreak.body).toMatchObject({
      teacherId: 101,
      kind: "break",
      breakAfterLesson: 2,
    });

    const ordered = await request(app).get("/api/teacher/schedule").expect(200);
    expect(ordered.body.map((entry: ScheduleRow) => entry.title)).toEqual([
      "الحصة الأولى",
      "الحصة الثانية",
      "استراحة",
      "الحصة الثالثة",
    ]);

    const updatedBreak = await request(app)
      .patch(`/api/teacher/schedule/${createdBreak.body.id}`)
      .send({ title: "استراحة معدلة", startTime: "09:35", endTime: "09:50" })
      .expect(200);
    expect(updatedBreak.body).toMatchObject({
      id: createdBreak.body.id,
      title: "استراحة معدلة",
      breakAfterLesson: 2,
      startTime: "09:35",
      endTime: "09:50",
    });

    const reread = await request(app).get("/api/teacher/schedule").expect(200);
    expect(
      reread.body.find(
        (entry: ScheduleRow) => entry.id === createdBreak.body.id,
      ),
    ).toMatchObject({
      title: "استراحة معدلة",
      breakAfterLesson: 2,
    });

    await request(app)
      .delete(`/api/teacher/schedule/${createdBreak.body.id}`)
      .expect(204);
    expect(
      (await request(app).get("/api/teacher/schedule").expect(200)).body.some(
        (entry: ScheduleRow) => entry.id === createdBreak.body.id,
      ),
    ).toBe(false);
  });

  it("isolates schedule breaks between teachers for reads and mutations", async () => {
    const teacherOne = makeApp({ teacherId: 101 });
    const teacherTwo = makeApp({ teacherId: 202 });

    const teacherOneBreak = await request(teacherOne)
      .post("/api/teacher/schedule")
      .send(breakEntry("استراحة المعلم الأول"))
      .expect(201);
    const teacherTwoBreak = await request(teacherTwo)
      .post("/api/teacher/schedule")
      .send(breakEntry("استراحة المعلم الثاني"))
      .expect(201);

    expect(
      (await request(teacherOne).get("/api/teacher/schedule").expect(200)).body,
    ).toEqual([
      expect.objectContaining({ id: teacherOneBreak.body.id, teacherId: 101 }),
    ]);
    expect(
      (await request(teacherTwo).get("/api/teacher/schedule").expect(200)).body,
    ).toEqual([
      expect.objectContaining({ id: teacherTwoBreak.body.id, teacherId: 202 }),
    ]);

    await request(teacherTwo)
      .patch(`/api/teacher/schedule/${teacherOneBreak.body.id}`)
      .send({ title: "محاولة تعديل غير مصرح بها" })
      .expect(404);
    await request(teacherTwo)
      .delete(`/api/teacher/schedule/${teacherOneBreak.body.id}`)
      .expect(404);

    expect(
      (await request(teacherOne).get("/api/teacher/schedule").expect(200)).body,
    ).toEqual([
      expect.objectContaining({
        id: teacherOneBreak.body.id,
        title: "استراحة المعلم الأول",
      }),
    ]);
  });

  it("rejects overlapping classes and breaks without changing existing entries", async () => {
    const app = makeApp({ teacherId: 101 });
    const existing = await request(app)
      .post("/api/teacher/schedule")
      .send({ ...lesson("الحصة الأولى", 1, "08:00"), endTime: "09:00" })
      .expect(201);
    await request(app)
      .post("/api/teacher/schedule")
      .send({ ...lesson("الحصة الثانية", 2, "10:00"), endTime: "11:00" })
      .expect(201);

    const conflictingBreak = await request(app)
      .post("/api/teacher/schedule")
      .send({ ...breakEntry(), startTime: "08:30", endTime: "08:45" })
      .expect(409);
    expect(conflictingBreak.body.message).toContain("يتعارض");

    const conflictingUpdate = await request(app)
      .patch(`/api/teacher/schedule/${existing.body.id}`)
      .send({ startTime: "10:30", endTime: "11:30" })
      .expect(409);
    expect(conflictingUpdate.body.message).toContain("يتعارض");

    const rows = (await request(app).get("/api/teacher/schedule").expect(200)).body;
    expect(rows).toHaveLength(2);
    expect(rows.find((row: ScheduleRow) => row.id === existing.body.id)).toMatchObject({
      id: existing.body.id,
      startTime: "08:00",
      endTime: "09:00",
    });
  });

  it("rejects a conflicting bulk schedule without inserting any lessons", async () => {
    const app = makeApp({ teacherId: 101 });
    await request(app)
      .post("/api/teacher/schedule")
      .send({ ...lesson("حصة موجودة", 1, "08:00"), endTime: "09:00" })
      .expect(201);

    const response = await request(app)
      .post("/api/teacher/schedule/bulk")
      .send({
        days: [1],
        lessons: [
          {
            lessonNumber: 2,
            title: "حصة متعارضة",
            subject: null,
            className: null,
            startTime: "08:30",
            endTime: "09:30",
          },
          {
            lessonNumber: 3,
            title: "حصة لاحقة",
            subject: null,
            className: null,
            startTime: "10:00",
            endTime: "11:00",
          },
        ],
      })
      .expect(409);
    expect(response.body.message).toContain("يتعارض");
    expect(response.body.conflict).toMatchObject({
      dayOfWeek: 1,
      lessonNumber: 2,
      startTime: "08:30",
      endTime: "09:30",
      conflictingTitle: "حصة موجودة",
      conflictingStartTime: "08:00",
      conflictingEndTime: "09:00",
    });

    const rows = (await request(app).get("/api/teacher/schedule").expect(200)).body;
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("حصة موجودة");
  });

  it("creates independent lesson sets for each selected day in one bulk save", async () => {
    const app = makeApp({ teacherId: 101 });
    const response = await request(app)
      .post("/api/teacher/schedule/bulk")
      .send({
        daySchedules: [
          {
            dayOfWeek: 0,
            lessons: [
              {
                lessonNumber: 1,
                title: "رياضيات الأحد",
                startTime: "08:00",
                endTime: "09:00",
              },
            ],
            breaks: Array.from({ length: 4 }, (_, index) => ({
              title: index === 0 ? "سناك" : `استراحة ${index + 1}`,
              breakAfterLesson: index + 1,
              startTime: `09:${String(index * 10).padStart(2, "0")}`,
              endTime: `09:${String((index + 1) * 10).padStart(2, "0")}`,
            })),
          },
          {
            dayOfWeek: 1,
            lessons: [
              {
                lessonNumber: 1,
                title: "علوم الاثنين",
                startTime: "10:00",
                endTime: "11:00",
              },
              {
                lessonNumber: 2,
                title: "لغة عربية الاثنين",
                startTime: "11:00",
                endTime: "12:00",
              },
            ],
          },
        ],
      })
      .expect(201);

    expect(response.body).toHaveLength(7);
    expect(response.body.filter((entry: { kind: string }) => entry.kind === "break")).toHaveLength(4);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "break",
        title: "سناك",
        dayOfWeek: 0,
        breakAfterLesson: 1,
        startTime: "09:00",
        endTime: "09:10",
      }),
    ]));
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ dayOfWeek: 0, title: "رياضيات الأحد" }),
      expect.objectContaining({ dayOfWeek: 1, title: "علوم الاثنين" }),
      expect.objectContaining({ dayOfWeek: 1, title: "لغة عربية الاثنين" }),
    ]));
  });

  it("saves a day containing only non-lesson periods", async () => {
    const app = makeApp({ teacherId: 101 });
    const response = await request(app)
      .post("/api/teacher/schedule/bulk")
      .send({
        daySchedules: [{
          dayOfWeek: 4,
          lessons: [],
          breaks: [{
            title: "اجتماع الهيئة التعليمية",
            breakAfterLesson: 0,
            startTime: "08:00",
            endTime: "09:00",
          }],
        }],
      })
      .expect(201);

    expect(response.body).toEqual([
      expect.objectContaining({
        kind: "break",
        title: "اجتماع الهيئة التعليمية",
        breakAfterLesson: 0,
      }),
    ]);
  });

  it("allows adjacent entries and the same time on another day or teacher", async () => {
    const teacherOne = makeApp({ teacherId: 101 });
    const teacherTwo = makeApp({ teacherId: 202 });
    await request(teacherOne)
      .post("/api/teacher/schedule")
      .send(lesson("الحصة الأولى", 1, "08:00"))
      .expect(201);

    await request(teacherOne)
      .post("/api/teacher/schedule")
      .send({ ...lesson("الحصة الثانية", 2, "09:00"), startTime: "09:00", endTime: "10:00" })
      .expect(201);
    await request(teacherOne)
      .post("/api/teacher/schedule")
      .send({ ...lesson("يوم آخر", 1, "08:00"), dayOfWeek: 2 })
      .expect(201);
    await request(teacherTwo)
      .post("/api/teacher/schedule")
      .send(lesson("معلم آخر", 1, "08:00"))
      .expect(201);
  });
});
