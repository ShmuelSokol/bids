import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getCurrentUser } from "@/lib/supabase-server";
import ExcelJS from "exceljs";

/**
 * POST /api/orders/dmf-header
 *
 * Generates the PO Header DMF file matching Yosef's 4-15-26 template:
 * sheet "Purchase_order_headers_V2", 108 columns. Populates only the
 * fields DIBS knows; everything else stays blank so the DMF project's
 * configured defaults take effect.
 *
 * Critical: PURCHASEORDERNUMBER is LEFT BLANK. The DMF project has
 * the "auto-generate" checkbox on — AX assigns numbers from its UI
 * sequence on import. DIBS then polls PurchaseOrderHeadersV2 by
 * VENDORORDERREFERENCE (which we stamp with our correlation ref) to
 * find out which PO# got assigned.
 *
 * Yosef's sample had PURCHASEORDERNUMBER populated because it was an
 * EXPORT (dump of existing PO), not an import template row.
 */

const ALL_HEADER_COLS = [
  "PURCHASEORDERNUMBER","ACCOUNTINGDATE","ACCOUNTINGDISTRIBUTIONTEMPLATENAME","AREPRICESINCLUDINGSALESTAX",
  "ATTENTIONINFORMATION","BANKDOCUMENTTYPE","BUYERGROUPID","CASHDISCOUNTCODE","CASHDISCOUNTPERCENTAGE",
  "CHARGEVENDORGROUPID","CONFIRMEDDELIVERYDATE","CONFIRMEDSHIPDATE","CONFIRMINGPURCHASEORDERCODE",
  "CONFIRMINGPURCHASEORDERCODELANGUAGEID","CONTACTPERSONID","CURRENCYCODE","DEFAULTLEDGERDIMENSIONDISPLAYVALUE",
  "DEFAULTRECEIVINGSITEID","DEFAULTRECEIVINGWAREHOUSEID","DELIVERYADDRESSCITY","DELIVERYADDRESSCOUNTRYREGIONID",
  "DELIVERYADDRESSCOUNTRYREGIONISOCODE","DELIVERYADDRESSCOUNTYID","DELIVERYADDRESSDESCRIPTION",
  "DELIVERYADDRESSDISTRICTNAME","DELIVERYADDRESSDUNSNUMBER","DELIVERYADDRESSLATITUDE","DELIVERYADDRESSLOCATIONID",
  "DELIVERYADDRESSLONGITUDE","DELIVERYADDRESSNAME","DELIVERYADDRESSPOSTBOX","DELIVERYADDRESSSTATEID",
  "DELIVERYADDRESSSTREET","DELIVERYADDRESSSTREETNUMBER","DELIVERYADDRESSTIMEZONE","DELIVERYADDRESSZIPCODE",
  "DELIVERYBUILDINGCOMPLIMENT","DELIVERYMODEID","DELIVERYTERMSID","DOCUMENTAPPROVALSTATUS","EMAIL",
  "EUSALESLISTCODE","EXPECTEDCROSSDOCKINGDATE","EXPECTEDSTOREAVAILABLESALESDATE","EXPECTEDSTORERECEIPTDATE",
  "FINTAGDISPLAYVALUE","FIXEDDUEDATE","FORMATTEDDELIVERYADDRESS","FORMATTEDINVOICEADDRESS",
  "INTRASTATPORTID","INTRASTATSTATISTICSPROCEDURECODE","INTRASTATTRANSACTIONCODE","INTRASTATTRANSPORTMODECODE",
  "INVOICEADDRESSCITY","INVOICEADDRESSCOUNTRYREGIONID","INVOICEADDRESSCOUNTY","INVOICEADDRESSSTATE",
  "INVOICEADDRESSSTREET","INVOICEADDRESSSTREETNUMBER","INVOICEADDRESSZIPCODE","INVOICEVENDORACCOUNTNUMBER",
  "ISCHANGEMANAGEMENTACTIVE","ISDELIVEREDDIRECTLY","ISDELIVERYADDRESSORDERSPECIFIC","ISDELIVERYADDRESSPRIVATE",
  "ISONETIMEVENDOR","LANGUAGEID","LINEDISCOUNTVENDORGROUPCODE","MULTILINEDISCOUNTVENDORGROUPCODE",
  "NUMBERSEQUENCEGROUPID","ORDERERPERSONNELNUMBER","ORDERVENDORACCOUNTNUMBER","OVERRIDESALESTAX",
  "PAYMENTSCHEDULENAME","PAYMENTTERMSNAME","PRICEVENDORGROUPCODE","PROJECTID","PURCHASEORDERHEADERCREATIONMETHOD",
  "PURCHASEORDERNAME","PURCHASEORDERPOOLID","PURCHASEORDERSTATUS","PURCHASEREBATEVENDORGROUPID",
  "REASONCODE","REASONCOMMENT","REPLENISHMENTSERVICECATEGORYID","REPLENISHMENTWAREHOUSEID",
  "REQUESTEDDELIVERYDATE","REQUESTEDSHIPDATE","REQUESTERPERSONNELNUMBER","SALESTAXGROUPCODE",
  "SHIPCALENDARID","SHIPPINGCARRIERID","SHIPPINGCARRIERSERVICEGROUPID","SHIPPINGCARRIERSERVICEID",
  "TAXEXEMPTNUMBER","TOTALDISCOUNTPERCENTAGE","TOTALDISCOUNTVENDORGROUPCODE","TRADEENDCUSTOMERACCOUNT",
  "TRANSPORTATIONDOCUMENTLINEID","TRANSPORTATIONMODEID","TRANSPORTATIONROUTEPLANID","TRANSPORTATIONTEMPLATEID",
  "URL","VENDORORDERREFERENCE","VENDORPAYMENTMETHODNAME","VENDORPAYMENTMETHODSPECIFICATIONNAME",
  "VENDORPOSTINGPROFILEID","VENDORTRANSACTIONSETTLEMENTTYPE",
];

// Values present on every DIBS-DD219 PO per Yosef's 2025-01-14 sample
const CONSTANTS: Record<string, any> = {
  AREPRICESINCLUDINGSALESTAX: "No",
  BANKDOCUMENTTYPE: "None",
  CASHDISCOUNTPERCENTAGE: 0,
  CONFIRMEDDELIVERYDATE: "1900-01-01",
  CONFIRMEDSHIPDATE: "1900-01-01",
  CURRENCYCODE: "USD",
  DEFAULTRECEIVINGSITEID: "S01",
  DEFAULTRECEIVINGWAREHOUSEID: "W01", // DIBS POs always W01 per Yosef 4-15
  DELIVERYADDRESSCITY: "Brooklyn",
  DELIVERYADDRESSCOUNTRYREGIONID: "USA",
  DELIVERYADDRESSCOUNTRYREGIONISOCODE: "US",
  DELIVERYADDRESSDESCRIPTION: "SZY Brooklyn",
  DELIVERYADDRESSLATITUDE: 0,
  DELIVERYADDRESSLOCATIONID: "000000203",
  DELIVERYADDRESSLONGITUDE: 0,
  DELIVERYADDRESSNAME: "SZY Brooklyn",
  DELIVERYADDRESSSTATEID: "NY",
  DELIVERYADDRESSSTREET: "300 Liberty Avenue",
  DELIVERYADDRESSZIPCODE: "11207",
  EUSALESLISTCODE: "IncludeNot",
  EXPECTEDCROSSDOCKINGDATE: "1900-01-01",
  EXPECTEDSTOREAVAILABLESALESDATE: "1900-01-01",
  EXPECTEDSTORERECEIPTDATE: "1900-01-01",
  FIXEDDUEDATE: "1900-01-01",
  FORMATTEDDELIVERYADDRESS: "300 Liberty Avenue\nBrooklyn, NY 11207\nUSA",
  ISCHANGEMANAGEMENTACTIVE: "No",
  ISDELIVEREDDIRECTLY: "No",
  ISDELIVERYADDRESSORDERSPECIFIC: "No",
  ISDELIVERYADDRESSPRIVATE: "No",
  ISONETIMEVENDOR: "No",
  LANGUAGEID: "en-US",
  ORDERERPERSONNELNUMBER: "000086",
  OVERRIDESALESTAX: "No",
  PAYMENTTERMSNAME: "PPD",
  PURCHASEORDERHEADERCREATIONMETHOD: "Purchase",
  PURCHASEORDERPOOLID: "DOM",
  REQUESTEDSHIPDATE: "1900-01-01",
  SALESTAXGROUPCODE: "NY-Exempt",
  TOTALDISCOUNTPERCENTAGE: 0,
  TRANSPORTATIONDOCUMENTLINEID: "{00000000-0000-0000-0000-000000000000}",
  VENDORPAYMENTMETHODNAME: "Check",
  VENDORPOSTINGPROFILEID: "ALL",
  VENDORTRANSACTIONSETTLEMENTTYPE: "None",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = createServiceClient();
  const { poIds } = await req.json();
  if (!Array.isArray(poIds) || poIds.length === 0) {
    return NextResponse.json({ error: "poIds[] required" }, { status: 400 });
  }

  const { data: pos, error } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier, ax_correlation_ref, dmf_state")
    .in("id", poIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const eligible = (pos || []).filter((p) => p.supplier && p.supplier !== "UNASSIGNED");
  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No POs with a real vendor. Use Switch Supplier on UNASSIGNED lines first." },
      { status: 400 }
    );
  }

  // Assign correlation refs if not yet
  for (const p of eligible) {
    if (!p.ax_correlation_ref) {
      const ref = `DIBS-${p.id}-${Date.now().toString(36)}`.toUpperCase();
      await supabase.from("purchase_orders").update({ ax_correlation_ref: ref }).eq("id", p.id);
      p.ax_correlation_ref = ref;
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const wb = new ExcelJS.Workbook();
  wb.creator = "DIBS";
  const ws = wb.addWorksheet("Purchase_order_headers_V2");
  ws.addRow(ALL_HEADER_COLS);

  for (const p of eligible) {
    const row: Record<string, any> = { ...CONSTANTS };
    // Variables per PO
    row.ACCOUNTINGDATE = todayIso;
    row.REQUESTEDDELIVERYDATE = todayIso;
    row.ORDERVENDORACCOUNTNUMBER = p.supplier;
    row.INVOICEVENDORACCOUNTNUMBER = p.supplier;
    row.VENDORORDERREFERENCE = p.ax_correlation_ref; // the handle DIBS uses to find the PO back
    // PURCHASEORDERNUMBER intentionally left blank — auto-generate handles it
    ws.addRow(ALL_HEADER_COLS.map((c) => row[c] ?? ""));
  }
  ws.columns.forEach((c) => (c.width = 22));

  // Flip state so poll-ax picks them up
  await supabase
    .from("purchase_orders")
    .update({ dmf_state: "awaiting_po_number" })
    .in("id", eligible.map((p) => p.id));

  const buf = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  return new NextResponse(new Blob([buf as BlobPart]), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dibs-po-headers-${todayIso}.xlsx"`,
      "X-Po-Count": String(eligible.length),
    },
  });
}
