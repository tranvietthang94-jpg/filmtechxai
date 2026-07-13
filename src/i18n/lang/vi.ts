import type { UIStrings } from "../types";

export default {
  nav: {
    home: "Trang chủ",
    posts: "Bài viết",
    tags: "Thẻ",
    about: "Giới thiệu",
    archives: "Lưu trữ",
    search: "Tìm kiếm",
  },
  post: {
    publishedAt: "Đăng lúc",
    updatedAt: "Cập nhật",
    sharePostIntro: "Chia sẻ bài viết:",
    sharePostOn: "Chia sẻ trên {{platform}}",
    sharePostViaEmail: "Chia sẻ qua email",
    tagLabel: "Thẻ",
    backToTop: "Lên đầu trang",
    goBack: "Quay lại",
    editPage: "Sửa trang",
    previousPost: "Bài trước",
    nextPost: "Bài sau",
  },
  pagination: {
    prev: "Trước",
    next: "Sau",
    page: "Trang",
  },
  home: {
    socialLinks: "Mạng xã hội",
    featured: "Nổi bật",
    recentPosts: "Bài viết gần đây",
    allPosts: "Tất cả bài viết",
  },
  footer: {
    copyright: "Bản quyền",
    allRightsReserved: "Bảo lưu mọi quyền.",
  },
  pages: {
    tagTitle: "Thẻ",
    tagDesc: "Tất cả bài viết với thẻ",

    tagsTitle: "Các thẻ",
    tagsDesc: "Tất cả các thẻ được sử dụng.",

    postsTitle: "Bài viết",
    postsDesc: "Tất cả bài viết đã đăng.",

    archivesTitle: "Lưu trữ",
    archivesDesc: "Tất cả bài viết đã lưu trữ.",

    searchTitle: "Tìm kiếm",
    searchDesc: "Tìm kiếm bài viết...",
  },
  a11y: {
    skipToContent: "Bỏ qua đến nội dung",
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
    toggleTheme: "Chuyển giao diện",
    searchPlaceholder: "Tìm kiếm bài viết...",
    noResults: "Không tìm thấy kết quả",
    goToPreviousPage: "Về trang trước",
    goToNextPage: "Đến trang sau",
  },
  notFound: {
    title: "404 Không tìm thấy",
    message: "Không tìm thấy trang",
    goHome: "Về trang chủ",
  },
} satisfies UIStrings;