import { describe, it, expect } from "vitest"
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiConflict,
  apiRateLimited,
  apiValidationError,
} from "@/lib/api/response"
import { ZodError, ZodIssueCode } from "zod"

describe("API Response Utilities", () => {
  describe("apiSuccess", () => {
    it("returns success envelope with data", async () => {
      const res = apiSuccess({ name: "John" })
      const body = await res.json()
      expect(body).toEqual({ success: true, data: { name: "John" } })
      expect(res.status).toBe(200)
    })

    it("allows custom status code", async () => {
      const res = apiSuccess(null, 202)
      expect(res.status).toBe(202)
    })
  })

  describe("apiCreated", () => {
    it("returns 201 with success envelope", async () => {
      const res = apiCreated({ id: "abc" })
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe("abc")
      expect(res.status).toBe(201)
    })
  })

  describe("apiError", () => {
    it("returns error envelope", async () => {
      const res = apiError("Something failed", 500)
      const body = await res.json()
      expect(body).toEqual({ success: false, error: "Something failed" })
      expect(res.status).toBe(500)
    })

    it("includes code and details when provided", async () => {
      const res = apiError("Bad input", 400, "BAD_INPUT", { field: "name" })
      const body = await res.json()
      expect(body.code).toBe("BAD_INPUT")
      expect(body.details).toEqual({ field: "name" })
    })

    it("omits code and details when not provided", async () => {
      const res = apiError("Oops")
      const body = await res.json()
      expect(body).not.toHaveProperty("code")
      expect(body).not.toHaveProperty("details")
    })
  })

  describe("error shorthand functions", () => {
    it("apiUnauthorized returns 401", async () => {
      const res = apiUnauthorized()
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.code).toBe("UNAUTHORIZED")
    })

    it("apiForbidden returns 403", async () => {
      const res = apiForbidden()
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.code).toBe("FORBIDDEN")
    })

    it("apiNotFound returns 404", async () => {
      const res = apiNotFound()
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.code).toBe("NOT_FOUND")
    })

    it("apiBadRequest returns 400 with details", async () => {
      const res = apiBadRequest("Invalid phone", { field: "phone" })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.code).toBe("BAD_REQUEST")
      expect(body.details).toEqual({ field: "phone" })
    })

    it("apiConflict returns 409", async () => {
      const res = apiConflict("Already exists")
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe("CONFLICT")
    })

    it("apiRateLimited returns 429", async () => {
      const res = apiRateLimited()
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.code).toBe("RATE_LIMITED")
    })
  })

  describe("apiValidationError", () => {
    it("extracts first issue message from ZodError", async () => {
      const zodError = new ZodError([
        {
          code: ZodIssueCode.too_small,
          minimum: 1,
          type: "string",
          inclusive: true,
          message: "Name is required",
          path: ["name"],
        },
      ])
      const res = apiValidationError(zodError)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("Name is required")
      expect(body.code).toBe("VALIDATION_ERROR")
      expect(body.details).toHaveLength(1)
    })
  })
})
