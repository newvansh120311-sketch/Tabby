// Invented order text in the shape OCR returns for each app's order summary screen.
// None of this comes from a real account; restaurants, items and amounts are made up.
import { BillSource, ChargeType } from './types';

export interface OrderFixture {
  name: string;
  source: BillSource;
  packageName?: string;
  text: string;
  expect: {
    items: { name: string; amountMinor: number; qty?: number }[];
    charges: Partial<Record<ChargeType, number>>;
    totalMinor: number;
  };
}

export const ORDER_FIXTURES: OrderFixture[] = [
  // ---------- Swiggy ----------
  {
    name: 'swiggy late night biryani',
    source: 'swiggy',
    packageName: 'in.swiggy.android',
    text: `Swiggy
Order #182736455102
Meghna's Biryani House
Koramangala, Bengaluru
Delivered on 14 Nov 2026, 11:48 PM
2 x Chicken Dum Biryani ₹598
1 x Paneer 65 ₹249
3 x Rumali Roti ₹135
1 x Double Ka Meetha ₹129
2 x Thums Up 300ml ₹80
1 x Mirchi Ka Salan ₹60
Bill Details
Item Total ₹1,251
Delivery Fee | 4.2 kms ₹46
Platform Fee ₹10
Restaurant Packaging Charges ₹45
GST and Restaurant Charges ₹68.95
Discount Applied (MIDNIGHT100) -₹100
Delivery Partner Tip ₹30
To Pay ₹1,350.95
Paid via UPI`,
    expect: {
      items: [
        { name: 'Chicken Dum Biryani', amountMinor: 59800, qty: 2 },
        { name: 'Paneer 65', amountMinor: 24900, qty: 1 },
        { name: 'Rumali Roti', amountMinor: 13500, qty: 3 },
        { name: 'Double Ka Meetha', amountMinor: 12900 },
        { name: 'Thums Up 300ml', amountMinor: 8000, qty: 2 },
        { name: 'Mirchi Ka Salan', amountMinor: 6000 },
      ],
      charges: { delivery: 4600, platform: 1000, packaging: 4500, tax: 6895, coupon: -10000, partner_tip: 3000 },
      totalMinor: 135095,
    },
  },
  {
    name: 'swiggy one dosa order',
    source: 'swiggy',
    packageName: 'in.swiggy.android',
    text: `Order Summary
Udupi Grand Tiffins
3 x Masala Dosa ₹330
2 x Filter Coffee ₹100
1 x Rava Idli ₹85
Item Total ₹515
Delivery Fee FREE
Swiggy One Benefit -₹38
Platform Fee ₹6
GST and Restaurant Charges ₹26.05
Delivery Partner Tip ₹20
To Pay ₹529.05`,
    expect: {
      items: [
        { name: 'Masala Dosa', amountMinor: 33000, qty: 3 },
        { name: 'Filter Coffee', amountMinor: 10000, qty: 2 },
        { name: 'Rava Idli', amountMinor: 8500 },
      ],
      charges: { membership: -3800, platform: 600, tax: 2605, partner_tip: 2000 },
      totalMinor: 52905,
    },
  },
  {
    name: 'swiggy pizza with item discount, price on next line',
    source: 'swiggy',
    text: `Swiggy
Crust & Co. Pizzeria
Farmhouse Pizza x 2
₹798
Garlic Breadsticks
₹159
Choco Lava Cake x 2
₹198
Item Total
₹1,155
Extra discount for you
-₹115
Delivery Fee | 2.1 kms
₹29
Platform Fee
₹10
GST and Restaurant Charges
₹54.67
To Pay
₹1,133.67`,
    expect: {
      items: [
        { name: 'Farmhouse Pizza', amountMinor: 79800, qty: 2 },
        { name: 'Garlic Breadsticks', amountMinor: 15900 },
        { name: 'Choco Lava Cake', amountMinor: 19800, qty: 2 },
      ],
      charges: { discount: -11500, delivery: 2900, platform: 1000, tax: 5467 },
      totalMinor: 113367,
    },
  },
  // ---------- Zomato ----------
  {
    name: 'zomato biryani run with gold',
    source: 'zomato',
    packageName: 'com.application.zomato',
    text: `zomato
Order summary
Shah Ghouse Biryani Point
1 x Mutton Biryani Family Pack ₹749
2 x Chicken 65 ₹458
1 x Khubani Ka Meetha ₹139
Item total ₹1,346
Gold discount -₹134.60
Delivery fee ₹0
Platform fee ₹11
Taxes ₹60.57
Restaurant packaging charges ₹40
Coupon - ZOMSAVE -₹75
Tip for your delivery partner ₹25
Grand total ₹1,272.97`,
    expect: {
      items: [
        { name: 'Mutton Biryani Family Pack', amountMinor: 74900 },
        { name: 'Chicken 65', amountMinor: 45800, qty: 2 },
        { name: 'Khubani Ka Meetha', amountMinor: 13900 },
      ],
      charges: { membership: -13460, platform: 1100, tax: 6057, packaging: 4000, coupon: -7500, partner_tip: 2500 },
      totalMinor: 127297,
    },
  },
  {
    name: 'zomato momo order with feeding india',
    source: 'zomato',
    packageName: 'com.application.zomato',
    text: `Order summary
Himalayan Momo Co.
Steamed Chicken Momos (x2) ₹318
Fried Veg Momos ₹149
Thukpa ₹199
Item total ₹666
Delivery fee ₹39
Platform fee ₹11
Taxes & charges ₹33.30
Feeding India donation ₹3
Grand total ₹752.30`,
    expect: {
      items: [
        { name: 'Steamed Chicken Momos', amountMinor: 31800, qty: 2 },
        { name: 'Fried Veg Momos', amountMinor: 14900 },
        { name: 'Thukpa', amountMinor: 19900 },
      ],
      charges: { delivery: 3900, platform: 1100, tax: 3330, other: 300 },
      totalMinor: 75230,
    },
  },
  {
    name: 'zomato north indian with promo',
    source: 'zomato',
    text: `zomato
Punjabi Tadka Dhaba
2 x Dal Makhani ₹520
1 x Butter Chicken ₹389
4 x Butter Naan ₹240
1 x Jeera Rice ₹179
Item total ₹1,328
Promo FEAST150 -₹150
Delivery fee ₹49
Platform fee ₹11
Taxes ₹58.90
Grand total ₹1,296.90`,
    expect: {
      items: [
        { name: 'Dal Makhani', amountMinor: 52000, qty: 2 },
        { name: 'Butter Chicken', amountMinor: 38900 },
        { name: 'Butter Naan', amountMinor: 24000, qty: 4 },
        { name: 'Jeera Rice', amountMinor: 17900 },
      ],
      charges: { coupon: -15000, delivery: 4900, platform: 1100, tax: 5890 },
      totalMinor: 129690,
    },
  },
  // ---------- Instamart ----------
  {
    name: 'instamart weekly groceries',
    source: 'instamart',
    packageName: 'in.swiggy.android',
    text: `Swiggy Instamart
Order delivered in 12 mins
6 items
Amul Taaza Toned Milk 1L x 3 ₹204
Brown Bread 400g ₹55
Farm Eggs 12 pcs ₹96
Bananas Robusta 1kg ₹62
Tata Salt 1kg ₹28
Maggi Masala Noodles 4 pack x 2 ₹112
Item Total ₹557
Handling Fee ₹9
Delivery Fee ₹25
Late Night Fee ₹15
Delivery Partner Tip ₹10
To Pay ₹616`,
    expect: {
      items: [
        { name: 'Amul Taaza Toned Milk 1L', amountMinor: 20400, qty: 3 },
        { name: 'Brown Bread 400g', amountMinor: 5500 },
        { name: 'Farm Eggs 12 pcs', amountMinor: 9600 },
        { name: 'Bananas Robusta 1kg', amountMinor: 6200 },
        { name: 'Tata Salt 1kg', amountMinor: 2800 },
        { name: 'Maggi Masala Noodles 4 pack', amountMinor: 11200, qty: 2 },
      ],
      charges: { platform: 2400, delivery: 2500, partner_tip: 1000 },
      totalMinor: 61600,
    },
  },
  {
    name: 'instamart party snacks',
    source: 'instamart',
    text: `Instamart
Lays Classic Salted 52g x 4 ₹80
Kurkure Masala Munch x 3 ₹60
Coca Cola 750ml x 2 ₹90
Paper Cups 50 pcs ₹65
Item Total ₹295
Delivery Fee FREE
Handling Fee ₹6
Small Cart Fee ₹0
Coupon INSTA50 -₹50
To Pay ₹251`,
    expect: {
      items: [
        { name: 'Lays Classic Salted 52g', amountMinor: 8000, qty: 4 },
        { name: 'Kurkure Masala Munch', amountMinor: 6000, qty: 3 },
        { name: 'Coca Cola 750ml', amountMinor: 9000, qty: 2 },
        { name: 'Paper Cups 50 pcs', amountMinor: 6500 },
      ],
      charges: { platform: 600, coupon: -5000 },
      totalMinor: 25100,
    },
  },
  {
    name: 'instamart fruit run with swiggy one',
    source: 'instamart',
    text: `Swiggy Instamart
Alphonso Mangoes 1 dozen ₹899
Greek Yogurt 400g x 2 ₹220
Item Total ₹1,119
Delivery Fee ₹30
Swiggy One savings -₹30
Handling Fee ₹9
To Pay ₹1,128`,
    expect: {
      items: [
        { name: 'Alphonso Mangoes 1 dozen', amountMinor: 89900 },
        { name: 'Greek Yogurt 400g', amountMinor: 22000, qty: 2 },
      ],
      charges: { delivery: 3000, membership: -3000, platform: 900 },
      totalMinor: 112800,
    },
  },
  // ---------- Zepto ----------
  {
    name: 'zepto breakfast basics',
    source: 'zepto',
    packageName: 'com.zeptoconsumerapp',
    text: `zepto
Bill summary
Mother Dairy Full Cream Milk 500ml x 4 ₹136
Britannia Butter 100g ₹58
Kellogg's Corn Flakes 475g ₹199
Item Total ₹393
Handling Charge ₹4
Delivery Fee ₹0
Small Cart Fee ₹0
Zepto Pass savings -₹25
To Pay ₹372`,
    expect: {
      items: [
        { name: 'Mother Dairy Full Cream Milk 500ml', amountMinor: 13600, qty: 4 },
        { name: 'Britannia Butter 100g', amountMinor: 5800 },
        { name: "Kellogg's Corn Flakes 475g", amountMinor: 19900 },
      ],
      charges: { platform: 400, membership: -2500 },
      totalMinor: 37200,
    },
  },
  {
    name: 'zepto cleaning supplies',
    source: 'zepto',
    text: `Zepto
Surf Excel Matic 2kg ₹489
Vim Dishwash Gel 500ml x 2 ₹198
Garbage Bags Medium 30 pcs ₹99
Item Total ₹786
Handling Charge ₹9
Delivery Fee ₹15
Coupon SAVE60 -₹60
Tip ₹20
To Pay ₹770`,
    expect: {
      items: [
        { name: 'Surf Excel Matic 2kg', amountMinor: 48900 },
        { name: 'Vim Dishwash Gel 500ml', amountMinor: 19800, qty: 2 },
        { name: 'Garbage Bags Medium 30 pcs', amountMinor: 9900 },
      ],
      charges: { platform: 900, delivery: 1500, coupon: -6000, tip: 2000 },
      totalMinor: 77000,
    },
  },
  {
    name: 'zepto ice cream order',
    source: 'zepto',
    text: `zepto
Delivered in 9 mins
Kwality Walls Cornetto x 5 ₹200
Amul Kulfi x 4 ₹100
Item Total ₹300
Handling Charge ₹4
Small Cart Fee ₹25
Delivery Fee ₹30
To Pay ₹359`,
    expect: {
      items: [
        { name: 'Kwality Walls Cornetto', amountMinor: 20000, qty: 5 },
        { name: 'Amul Kulfi', amountMinor: 10000, qty: 4 },
      ],
      charges: { platform: 2900, delivery: 3000 },
      totalMinor: 35900,
    },
  },
  // ---------- Blinkit ----------
  {
    name: 'blinkit house party',
    source: 'blinkit',
    packageName: 'com.grofers.customerapp',
    text: `blinkit
Order summary
Bisleri Water 1L x 6 ₹120
Haldiram's Aloo Bhujia 400g ₹110
Paper Plates 25 pcs x 2 ₹130
Ice Cubes 1kg x 2 ₹100
Items total ₹460
Handling charge ₹4
Delivery charge ₹25
Feeding India donation ₹1
Tip for your delivery partner ₹20
Grand total ₹510
You saved ₹45 on this order`,
    expect: {
      items: [
        { name: 'Bisleri Water 1L', amountMinor: 12000, qty: 6 },
        { name: "Haldiram's Aloo Bhujia 400g", amountMinor: 11000 },
        { name: 'Paper Plates 25 pcs', amountMinor: 13000, qty: 2 },
        { name: 'Ice Cubes 1kg', amountMinor: 10000, qty: 2 },
      ],
      charges: { platform: 400, delivery: 2500, other: 100, partner_tip: 2000 },
      totalMinor: 51000,
    },
  },
  {
    name: 'blinkit vegetables with coupon',
    source: 'blinkit',
    text: `Blinkit
Onion 1kg ₹42
Tomato Hybrid 500g ₹24
Potato 2kg ₹70
Coriander Bunch ₹15
Items total ₹151
Small cart charge ₹20
Handling charge ₹4
Delivery charge ₹30
Coupon FRESH20 -₹20
Grand total ₹185`,
    expect: {
      items: [
        { name: 'Onion 1kg', amountMinor: 4200 },
        { name: 'Tomato Hybrid 500g', amountMinor: 2400 },
        { name: 'Potato 2kg', amountMinor: 7000 },
        { name: 'Coriander Bunch', amountMinor: 1500 },
      ],
      charges: { platform: 2400, delivery: 3000, coupon: -2000 },
      totalMinor: 18500,
    },
  },
  {
    name: 'blinkit stationery',
    source: 'blinkit',
    text: `blinkit
Classmate Notebook 172 pages x 3 ₹165
Reynolds Pen Pack ₹50
Items total ₹215
Handling charge ₹4
Delivery charge ₹0
Grand total ₹219`,
    expect: {
      items: [
        { name: 'Classmate Notebook 172 pages', amountMinor: 16500, qty: 3 },
        { name: 'Reynolds Pen Pack', amountMinor: 5000 },
      ],
      charges: { platform: 400 },
      totalMinor: 21900,
    },
  },
  // ---------- District ----------
  {
    name: 'district dinner payment screen',
    source: 'district',
    packageName: 'com.application.zomato.district',
    text: `District
Pay bill at Saffron Terrace
Booking ID DST88213
Bill amount ₹4,860
Pre-booked offer (Flat 20% off) -₹972
Bank offer HDFC -₹250
Convenience fee ₹29
Amount paid ₹3,667`,
    expect: {
      items: [{ name: 'Items', amountMinor: 486000 }],
      charges: { discount: -97200, coupon: -25000, platform: 2900 },
      totalMinor: 366700,
    },
  },
  {
    name: 'district brunch bill scanned',
    source: 'district',
    text: `District dining offer
The Courtyard Kitchen
Eggs Benedict 2 395.00 790.00
Avocado Toast 1 345.00 345.00
Cold Brew 3 180.00 540.00
Sub Total 1,675.00
CGST 2.5% 41.88
SGST 2.5% 41.88
Walk-in offer 10% -167.50
Grand Total 1,591.26`,
    expect: {
      items: [
        { name: 'Eggs Benedict', amountMinor: 79000, qty: 2 },
        { name: 'Avocado Toast', amountMinor: 34500, qty: 1 },
        { name: 'Cold Brew', amountMinor: 54000, qty: 3 },
      ],
      charges: { tax: 8376, discount: -16750 },
      totalMinor: 159126,
    },
  },
  {
    name: 'district cover charge booking',
    source: 'district',
    text: `District
Booking confirmed for 4 guests
Skyline Lounge
Cover charge ₹2,000
Table booking discount -₹400
Convenience fee ₹49
Amount paid ₹1,649`,
    expect: {
      items: [],
      charges: { other: 200000, discount: -40000, platform: 4900 },
      totalMinor: 164900,
    },
  },
  // ---------- EazyDiner ----------
  {
    name: 'eazydiner prime payment',
    source: 'eazydiner',
    packageName: 'com.eazydiner',
    text: `EazyDiner
PayEazy at Coastal Spice
Bill Amount ₹3,250
EazyDiner Prime discount -₹812.50
EazyPoints redeemed -₹100
Amount to pay ₹2,337.50`,
    expect: {
      items: [{ name: 'Items', amountMinor: 325000 }],
      charges: { membership: -91250 },
      totalMinor: 233750,
    },
  },
  {
    name: 'eazydiner deal offer bill',
    source: 'eazydiner',
    text: `EazyDiner deal
Bombay Brasserie Bistro
Prawn Koliwada ₹495
Chicken Ghee Roast ₹545
Neer Dosa x 4 ₹220
Sub Total ₹1,260
GST 5% ₹63
Deal offer -₹252
Grand Total ₹1,071`,
    expect: {
      items: [
        { name: 'Prawn Koliwada', amountMinor: 49500 },
        { name: 'Chicken Ghee Roast', amountMinor: 54500 },
        { name: 'Neer Dosa', amountMinor: 22000, qty: 4 },
      ],
      charges: { tax: 6300, discount: -25200 },
      totalMinor: 107100,
    },
  },
  {
    name: 'eazydiner cover charge',
    source: 'eazydiner',
    text: `EazyDiner
Booking confirmed, 2 pax
Cover charge ₹1,500
25% off -₹375
Amount to pay ₹1,125`,
    expect: {
      items: [],
      charges: { other: 150000, discount: -37500 },
      totalMinor: 112500,
    },
  },
  // ---------- Paper receipts ----------
  {
    name: 'clean cafe receipt',
    source: 'receipt',
    text: `THE CHAI ROOM
12 MG Road, Pune
Bill No: 4471 Table 6
Date: 08/11/2026 19:42
Masala Chai 2 40.00 80.00
Samosa 3 25.00 75.00
Bun Maska 1 45.00 45.00
Kanda Bhaji 1 90.00 90.00
Elaichi Chai 1 45.00 45.00
Sub Total 335.00
CGST 2.5% 8.38
SGST 2.5% 8.38
Round Off 0.24
Grand Total 352.00
Cash 400.00
Change 48.00
Thank you visit again`,
    expect: {
      items: [
        { name: 'Masala Chai', amountMinor: 8000, qty: 2 },
        { name: 'Samosa', amountMinor: 7500, qty: 3 },
        { name: 'Bun Maska', amountMinor: 4500, qty: 1 },
        { name: 'Kanda Bhaji', amountMinor: 9000, qty: 1 },
        { name: 'Elaichi Chai', amountMinor: 4500, qty: 1 },
      ],
      charges: { tax: 1676, other: 24 },
      totalMinor: 35200,
    },
  },
  {
    name: 'us taqueria receipt with tip',
    source: 'receipt',
    text: `CASA LUNA TAQUERIA
Server: Alma  Guests: 4
Carne Asada Tacos $14.50
Al Pastor Tacos $13.00
Fish Tacos $15.25
Chicken Quesadilla $12.00
Loaded Nachos $16.00
Guacamole $9.50
Horchata x2 $8.00
Jarritos $3.50
Churros $7.25
Subtotal $99.00
Tax 8.875% $8.79
Tip 18% $17.82
Total $125.61
VISA ****4411`,
    expect: {
      items: [
        { name: 'Carne Asada Tacos', amountMinor: 1450 },
        { name: 'Al Pastor Tacos', amountMinor: 1300 },
        { name: 'Fish Tacos', amountMinor: 1525 },
        { name: 'Chicken Quesadilla', amountMinor: 1200 },
        { name: 'Loaded Nachos', amountMinor: 1600 },
        { name: 'Guacamole', amountMinor: 950 },
        { name: 'Horchata', amountMinor: 800, qty: 2 },
        { name: 'Jarritos', amountMinor: 350 },
        { name: 'Churros', amountMinor: 725 },
      ],
      charges: { tax: 879, tip: 1782 },
      totalMinor: 12561,
    },
  },
  {
    name: 'faded thermal receipt with OCR noise',
    source: 'receipt',
    text: `SUNRISE BAKERY
GSTIN 27ABCDE1234F1Z5
Veg Puff     30
Chicken Puff    45
Black Forest Pastry   90
Cold Coffee    120
Plum Cake 250g   180
Total    465
Thank you`,
    expect: {
      items: [
        { name: 'Veg Puff', amountMinor: 3000 },
        { name: 'Chicken Puff', amountMinor: 4500 },
        { name: 'Black Forest Pastry', amountMinor: 9000 },
        { name: 'Cold Coffee', amountMinor: 12000 },
        { name: 'Plum Cake 250g', amountMinor: 18000 },
      ],
      charges: {},
      totalMinor: 46500,
    },
  },
  // ---------- Emails ----------
  {
    name: 'zomato email receipt',
    source: 'email',
    packageName: 'com.google.android.gm',
    text: `From: Zomato <noreply@zomato.example>
Subject: Your Zomato order from Tandoori Nights
Date: Fri, 6 Nov 2026 21:14
Thanks for ordering with Zomato!
Order summary
Tandoori Chicken Half ₹349
Garlic Naan x 3 ₹165
Item total ₹514
Delivery fee ₹35
Platform fee ₹11
Taxes ₹25.70
Grand total ₹585.70
Unsubscribe`,
    expect: {
      items: [
        { name: 'Tandoori Chicken Half', amountMinor: 34900 },
        { name: 'Garlic Naan', amountMinor: 16500, qty: 3 },
      ],
      charges: { delivery: 3500, platform: 1100, tax: 2570 },
      totalMinor: 58570,
    },
  },
  {
    name: 'swiggy email receipt pasted',
    source: 'email',
    text: `Subject: Your Swiggy order summary
From: Swiggy <no-reply@swiggy.example>
Order delivered
2 x Veg Thali ₹398
1 x Sweet Lassi ₹79
Item Total ₹477
Delivery Fee ₹25
Platform Fee ₹10
GST and Restaurant Charges ₹23.85
To Pay ₹535.85`,
    expect: {
      items: [
        { name: 'Veg Thali', amountMinor: 39800, qty: 2 },
        { name: 'Sweet Lassi', amountMinor: 7900 },
      ],
      charges: { delivery: 2500, platform: 1000, tax: 2385 },
      totalMinor: 53585,
    },
  },
];
