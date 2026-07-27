import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toNaverWeatherPlaceLabel } from "./weather.ts";

describe("toNaverWeatherPlaceLabel", () => {
  it("keeps only si/gun/gu (and metro short name)", () => {
    assert.equal(
      toNaverWeatherPlaceLabel("부산광역시 해운대구 우동 123-4"),
      "부산 해운대구",
    );
    assert.equal(
      toNaverWeatherPlaceLabel("서울특별시 강남구 역삼동 123"),
      "서울 강남구",
    );
    assert.equal(
      toNaverWeatherPlaceLabel("경기도 성남시 분당구 정자동"),
      "성남시 분당구",
    );
    assert.equal(
      toNaverWeatherPlaceLabel("경기도 하남시 감북동 1"),
      "하남시",
    );
    assert.equal(toNaverWeatherPlaceLabel("강원도 정선군 북평면"), "정선군");
  });

  it("drops street/bunji orphan fragments like 난", () => {
    assert.equal(toNaverWeatherPlaceLabel("난 해운대구"), "해운대구");
    assert.equal(
      toNaverWeatherPlaceLabel("수영로 난 해운대구 부산"),
      "부산 해운대구",
    );
    assert.equal(
      toNaverWeatherPlaceLabel("우동 해운대구 부산광역시 대한민국"),
      "부산 해운대구",
    );
  });

  it("passes through plain city nameKo", () => {
    assert.equal(toNaverWeatherPlaceLabel("부산"), "부산");
    assert.equal(toNaverWeatherPlaceLabel("서울"), "서울");
    assert.equal(toNaverWeatherPlaceLabel("하남"), "하남");
  });
});
