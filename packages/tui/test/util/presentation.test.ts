import { expect, test } from "bun:test"
import { logo } from "../../src/logo"
import { sessionEpilogue } from "../../src/util/presentation"

test("keeps the KoteCode wordmark aligned and gives it cat ears", () => {
  expect(logo.left[0]).toContain("/\\:/\\")
  expect(logo.left.map((line) => line.length)).toEqual([19, 19, 19, 19])
  expect(logo.right.map((line) => line.length)).toEqual([19, 19, 19, 19])
})

test("formats session continuation summary", () => {
  const epilogue = sessionEpilogue({ title: "A session", sessionID: "ses_123" })
  expect(epilogue).toContain("A session")
  expect(epilogue).toContain("kotencode -s ses_123")
})
