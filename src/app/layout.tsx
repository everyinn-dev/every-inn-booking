import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
	variable: "--font",
	subsets: ["vietnamese", "latin"],
	weight: ["300", "400", "500", "600", "700"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "Every Inn | Hotels, Homes and Everything In – Nguyễn Công Hoan, P.Cầu Kiệu (Quận Phú Nhuận cũ), TP.HCM",
	description: "Every Inn – Căn hộ mini tối giản, tự nhận phòng 24/7 tại 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu. Gần sân bay Tân Sơn Nhất. Combo 3H, 6H, Qua đêm, Phòng ngày từ 256.000đ. Nhắn tin Instagram đặt ngay.",
	keywords: "every inn, homestay Phú Nhuận, thuê phòng nguyễn công hoan, gần sân bay tân sơn nhất, căn hộ ngắn hạn sài gòn, tự nhận phòng 24/7, combo 3h 6h qua đêm phòng ngày, haven signature",
	openGraph: {
		type: "website",
		title: "Every Inn | Hotels, Homes and Everything In",
		description: "Căn hộ mini tối giản, tự nhận phòng 24/7. Gần sân bay Tân Sơn Nhất. Combo 3H, 6H, Qua đêm, Phòng ngày. Nhắn tin Instagram đặt ngay.",
		url: "https://everyinn.vn/",
		images: [
			{
				url: "https://res.cloudinary.com/gsldcdgb/image/upload/c_fill,w_1200,h_630,q_80,f_auto/v1785586726/20_sc3x5z.jpg",
				alt: "Every Inn – Phòng Signature 102, Nguyễn Công Hoan",
			},
		],
		locale: "vi_VN",
		siteName: "Every Inn",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="vi">
			<body
				className={`${beVietnamPro.variable} antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
