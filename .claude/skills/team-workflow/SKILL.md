---
name: team-workflow
description: Điều phối đội subagent của dự án Library Management System phía frontend (ba, sa, uiux, fe-dev, tester, perf-tester, reporter) thành một quy trình từ yêu cầu đến báo cáo. Dùng khi người dùng giao một tính năng, sửa lỗi, đợt kiểm thử hoặc đánh giá cần từ hai vai trò trở lên, hoặc nói "chạy workflow", "giao cho team", "làm tính năng X từ A-Z", "dùng các agent", "điều phối", ngay cả khi không nêu tên skill. Skill này chạy trong phiên chính, vì subagent không gọi được subagent khác.
---

# Team workflow (frontend)

Bạn là điều phối viên. Subagent không thể tự gọi subagent khác, nên chỉ phiên chính mới giao việc được. Hãy tự điều phối theo quy trình dưới đây.

Đội (định nghĩa ở `.claude/agents/`): `ba`, `sa`, `uiux`, `fe-dev`, `tester`, `perf-tester`, `reporter`. Mỗi agent đã có quy tắc riêng; việc của bạn là chia việc, giao đúng thứ tự và kiểm tra kết quả.

Repo này chỉ có phần frontend. Backend ở repo anh em `../library-management-system` (có đội `be-dev` riêng). Việc cần sửa BE thì không giao ở đây: ghi rõ hợp đồng API cần BE làm, rồi báo người dùng mở phiên ở repo BE.

## 1. Tiếp nhận và chọn vai trò

Đọc `CLAUDE.md` và `README.md` (bảng app/cổng, biến môi trường, cách thêm zone). Với nghiệp vụ và phân quyền, đọc CLAUDE.md và ADR-0003 ở repo BE. Chọn đường đi theo loại yêu cầu, chỉ gọi vai trò thật sự cần:

| Yêu cầu | Đường đi |
|---|---|
| Tính năng mới có giao diện | (sa) → uiux → fe-dev → tester → (perf-tester) → reporter |
| Tính năng cần API BE chưa có | (sa) → uiux → ghi hợp đồng cần BE → báo người dùng chuyển sang repo BE → fe-dev → tester → reporter |
| Chỉ chỉnh giao diện nhỏ | (uiux) → fe-dev → tester → reporter |
| Thay đổi kiến trúc (zone mới, đổi proxy/shell, package dùng chung, triển khai) | sa → fe-dev → tester → reporter |
| Sửa lỗi | tester tái hiện → fe-dev sửa → tester kiểm lại → reporter |
| Đánh giá hiệu năng | perf-tester → reporter |
| Đánh giá giao diện | uiux → reporter |
| Đánh giá/thiết kế kiến trúc | sa → reporter |
| Chỉ cần báo cáo | reporter |

`(sa)` chỉ gọi khi đụng tới kiến trúc: thêm zone mới, đổi cách shell chuyển tiếp zone, đổi luồng xác thực/cookie, đổi package dùng chung ảnh hưởng mọi zone, hoặc cần chọn giữa các phương án có đánh đổi rõ. Thêm một trang hay component trong zone sẵn có thì bỏ qua `sa`.

Nếu yêu cầu mơ hồ ở điểm làm thay đổi hướng đi, hỏi người dùng một lần trước khi giao việc; đừng để mỗi agent tự đoán khác nhau.

## 2. Các pha

**Pha BA. Lấy và làm rõ đề bài (khi yêu cầu còn mơ hồ).** Áp dụng cho tính năng mới hoặc đổi hành vi mà người dùng chỉ mô tả sơ lược. Việc hỏi người dùng do phiên chính làm (subagent không hỏi lại được); agent `ba` lo phân tích và viết đề bài. Cách chạy: giao `ba` brief gốc để nó đọc code và trả về danh sách câu hỏi kèm lựa chọn; phiên chính hỏi người dùng từng câu (AskUserQuestion); rồi giao lại `ba` kèm câu trả lời để viết đề bài. Các bước dưới đây là quy trình `ba` và phiên chính cùng theo. Bỏ qua khi yêu cầu đã rõ, hoặc là sửa lỗi/đánh giá/báo cáo.
1. **Đọc trước, hỏi sau**: xem `CLAUDE.md`, `README.md`, code zone/package liên quan và endpoint BE đã có. Đừng hỏi điều đọc code là biết.
2. **Hỏi từng câu một**, ưu tiên câu trắc nghiệm có 2-4 lựa chọn (dùng AskUserQuestion), kèm khuyến nghị của bạn ở lựa chọn đầu. Mỗi câu chỉ làm rõ một điểm. Thứ tự hỏi: mục đích và người dùng → phạm vi (làm gì, không làm gì) → màn hình và luồng thao tác → phân quyền (role nào thấy/làm được gì) → API BE cần → tiêu chí nghiệm thu. Dừng hỏi khi đủ để viết đề bài, thường 3-6 câu.
3. **Nêu 2-3 hướng tiếp cận** khi có đánh đổi rõ (ví dụ đặt ở zone nào), kèm khuyến nghị và lý do; để người dùng chọn.
4. **Trình bày đề bài từng phần ngắn** (mục tiêu, phạm vi, luồng người dùng, API dự kiến, tiêu chí nghiệm thu, ngoài phạm vi), sau mỗi phần hỏi "đúng ý chưa" trước khi viết tiếp. Không tự thêm tính năng người dùng không nhắc (YAGNI).
5. **Chốt**: ghi đề bài vào `docs/requirements/<ngày YYYY-MM-DD>-<chủ-đề>.md` (tạo thư mục nếu chưa có), đưa đường dẫn này làm đầu vào cho `sa`/`uiux`/`fe-dev`/`tester`. Người dùng duyệt xong mới sang pha tiếp theo.

**Pha 0. Kiến trúc (nếu đụng tới kiến trúc).** Giao `sa` ra phương án: quyết định chọn và lý do, phương án đã loại, ranh giới zone/package, rủi ro, phân việc. `sa` ghi vào `docs/design/<ngày>-<chủ-đề>.md` (tạo thư mục nếu chưa có). Đưa đường dẫn file làm đầu vào cho pha sau. Nếu có câu hỏi mở làm đổi hướng, hỏi người dùng trước. `sa` chỉ ghi trong `docs/`, không sửa code.

**Pha A. Thiết kế giao diện (nếu có giao diện mới).** Giao `uiux` ra đặc tả: bố cục, thành phần (antd + Tailwind), trạng thái rỗng/tải/lỗi, văn bản tiếng Việt. Đặc tả là đầu vào của `fe-dev`.

**Pha B. Hợp đồng API (nếu cần API mới).** Đối chiếu endpoint `/api/**` mà `lms-api` (BE) đã có. Chưa có hoặc cần đổi thì ghi hợp đồng mong muốn (đường dẫn, dữ liệu vào/ra, khóa quyền `TênController/tênMethod`) và báo người dùng chuyển sang repo BE; đừng bịa endpoint. FE chỉ dùng `/api/**`, các API `/internal/**` bị nginx trả 404.

**Pha C. Cài đặt.** Giao `fe-dev`. Việc chia được theo zone/package không phụ thuộc nhau thì gọi nhiều `fe-dev` song song trong cùng một lượt, mỗi agent một thư mục riêng. Sửa `packages/api` hay `packages/ui` thì làm trước và tuần tự, vì mọi zone dùng chung.

**Pha D. Kiểm thử.** Giao `tester`; thêm `perf-tester` khi liên quan hiệu năng (SSR, tải trang qua shell → zone, bundle). Hai agent này chỉ báo lỗi, không sửa code (tester chỉ được thêm test E2E). Có lỗi thì đưa danh sách cho `fe-dev` sửa rồi kiểm lại. Tối đa 2 vòng sửa; sau đó dừng và báo người dùng những lỗi còn mở thay vì lặp mãi.

**Pha E. Báo cáo.** Giao `reporter` tổng hợp. Reporter không thấy hội thoại và bị cấm bịa số liệu, nên phải đưa cho nó sự thật: việc đã làm, file đã đổi, kết quả typecheck/E2E, và những gì chưa kiểm chứng cùng lý do.

## 3. Viết brief cho mỗi lần giao việc

Agent bắt đầu từ trạng thái trống, không thấy hội thoại này. Brief tốt gồm:
- **Mục tiêu** và lý do.
- **Đầu vào**: file cần đọc, đặc tả từ agent trước (nguyên văn hoặc đường dẫn).
- **Phạm vi**: app/package được sửa, thứ không được đụng.
- **Tiêu chí hoàn thành**: kiểm tra được bằng lệnh hay hành vi cụ thể.
- **Cần trả về**: file đã đổi, kết quả kiểm tra, phần chưa kiểm chứng.

## 4. Kiểm tra kết quả, đừng tin báo cáo suông

Sau mỗi agent trả về, đối chiếu với tiêu chí đã giao. Với `sa`, kiểm tra thiết kế có nêu phương án đã loại và lý do không, có khớp code thật không (đọc vài file được trích dẫn), và rủi ro chưa kiểm chứng có được ghi ⚠️ không. Việc có thể kiểm bằng công cụ thì tự kiểm: đọc file đã đổi, chạy `npm run typecheck`. Agent báo thiếu hoặc lỗi thì giao lại kèm thông tin cụ thể, không bỏ qua.

Hạn chế môi trường cần nói thẳng, không che:
- Không có lint; kiểm tra gồm `npm run typecheck` và E2E Playwright.
- E2E chạy trên bản build với `e2e/mock-gateway.mjs` (cổng 8090), cần cổng 3000-3003, 3100, 8090 trống. `npm run test:e2e` tự build; sửa code app thì phải build lại. Không chạy được thì ghi ⚠️ chưa kiểm chứng, đừng ghi ✅.
- Chạy với BE thật cần `GATEWAY_URL` trỏ tới nginx của BE (mặc định `http://localhost:8080`); không có thì ghi rõ chưa thử với BE thật.

## 5. Quy tắc chung

- Không `git commit`/`git push`, không đụng secret hay `.env`, không sửa `package-lock.json` bằng tay. Cần commit thì hỏi người dùng và theo quy ước commit trong `CLAUDE.md`.
- Khóa quyền BE đổi thì sửa `packages/api/src/permissions.ts` (và literal trong `nav-links.ts`).
- Giữa các zone dùng `<a>`, không dùng `next/link`.
- Trả lời người dùng bằng tiếng Việt, ngắn gọn.

## 6. Báo cáo cho người dùng

Dùng bộ icon chuẩn: ✅ hoàn thành đã kiểm chứng · 🔄 đang xử lý · ⏳ chờ · ❌ lỗi · ⚠️ chưa kiểm chứng · 🚫 bị chặn · ⏭️ bỏ qua · ℹ️ ghi chú. Mỗi mục một icon và phải đúng thực tế. Cuối cùng nêu: ai đã làm gì, kết quả, lỗi còn mở, và việc người dùng cần quyết định.

Ví dụ định dạng tiến độ:

```
✅ uiux: đặc tả màn hình danh sách phiếu mượn
✅ fe-dev: trang circulation/loans (typecheck OK)
⚠️ fe-dev: E2E chưa chạy được vì cổng 3000 bị chiếm
🔄 fe-dev: bảng phạt trong zone admin
⏳ tester, reporter
```
