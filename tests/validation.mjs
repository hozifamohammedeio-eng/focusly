import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validName,
  validEmail,
  validPassword,
} from "../src/features/auth/validation.ts";
test("names accept Arabic and reject control characters and excessive length", () => {
  assert.ok(validName("أحمد محمد"));
  for (const value of ["", "a\nname", "a".repeat(81)])
    assert.equal(validName(value), false);
});
test("email validation rejects malformed and oversized input", () => {
  assert.ok(validEmail("student@example.com"));
  for (const value of [
    "student",
    "a@@example.com",
    "a b@example.com",
    "a".repeat(250) + "@test.com",
  ])
    assert.equal(validEmail(value), false);
});
test("password length boundaries match the auth forms", () => {
  assert.equal(validPassword("x".repeat(7)), false);
  assert.equal(validPassword("x".repeat(8)), true);
  assert.equal(validPassword("x".repeat(128)), true);
  assert.equal(validPassword("x".repeat(129)), false);
});
