import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import HotelSchema from "../components/HotelSchema";

const beVietnamPro = Be_Vietnam_Pro({
	variable: "--font",
	subsets: ["vietnamese", "latin"],
	weight: ["300", "400", "500", "600", "700"],
	display: "swap",
});

export const metadata: Metadata = {
	metadataBase: new URL("https://everyinn.vn"),
	alternates: {
		canonical: "/",
	},
	title: "Every Inn | Hotels, Homes and Everything In – Nguyễn Công Hoan, P.Cầu Kiệu (Quận Phú Nhuận cũ), TP.HCM",
	description: "Every Inn – Căn hộ mini tối giản, tự nhận phòng 24/7 tại 69/24L1 Nguyễn Công Hoan, Phường Cầu Kiệu. Gần sân bay Tân Sơn Nhất. Combo 3H, 6H, Qua đêm, Phòng ngày từ 256.000đ. Nhắn tin Instagram đặt ngay.",
	keywords: "every inn, every inn phú nhuận, homestay Phú Nhuận, khách sạn nguyễn công hoan, thuê phòng nguyễn công hoan, gần sân bay tân sơn nhất, căn hộ ngắn hạn sài gòn, tự nhận phòng 24/7, combo 3h 6h qua đêm phòng ngày, haven signature",
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	openGraph: {
		type: "website",
		title: "Every Inn | Hotels, Homes and Everything In",
		description: "Căn hộ mini tối giản, tự nhận phòng 24/7. Gần sân bay Tân Sơn Nhất. Combo 3H, 6H, Qua đêm, Phòng ngày từ 256.000đ. Nhắn tin Instagram đặt ngay.",
		url: "https://everyinn.vn/",
		images: [
			{
				url: "https://res.cloudinary.com/gsldcdgb/image/upload/c_fill,w_1200,h_630,q_80,f_auto/v1785586726/20_sc3x5z.jpg",
				width: 1200,
				height: 630,
				alt: "Every Inn – Phòng Signature 102, Nguyễn Công Hoan",
			},
		],
		locale: "vi_VN",
		siteName: "Every Inn",
	},
	twitter: {
		card: "summary_large_image",
		title: "Every Inn | Hotels, Homes and Everything In – Phú Nhuận, TP.HCM",
		description: "Căn hộ mini tối giản, tự nhận phòng 24/7 tại 69/24L1 Nguyễn Công Hoan. Gần sân bay Tân Sơn Nhất. Giá từ 256.000đ.",
		images: ["https://res.cloudinary.com/gsldcdgb/image/upload/c_fill,w_1200,h_630,q_80,f_auto/v1785586726/20_sc3x5z.jpg"],
	},
	other: {
		"geo.region": "VN-SG",
		"geo.placename": "Ho Chi Minh City",
		"geo.position": "10.799887;106.688916",
		ICBM: "10.799887, 106.688916",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="vi">
			<head>
				<HotelSchema />
			</head>
			<body
				className={`${beVietnamPro.variable} antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
