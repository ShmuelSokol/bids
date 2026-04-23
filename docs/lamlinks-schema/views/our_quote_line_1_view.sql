-- dbo.our_quote_line_1_view



/* view our_quote_line_1_view: add view */


/* view our_quote_line_1_view: add view */


/* view our_quote_line_1_view: add view */

/* view our_quote_line_1_view: add view */


/* view our_quote_line_1_view: add view */
/* view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view 
 view our_quote_line_1_view: add view */
CREATE VIEW dbo.our_quote_line_1_view
AS
SELECT        dbo.k10_tab.sol_no_k10, K08_TAB.niin_k08, K08_TAB.fsc_k08, K08_TAB.p_desc_k08, K34_TAB.upname_k34, K34_TAB.bidtyp_k34, K34_TAB.qrefno_k34, K34_TAB.mcage_k34, K34_TAB.pn_k34, K34_TAB.scage_k34, 
                         K34_TAB.trmdes_k34, K34_TAB.fobcod_k34, K34_TAB.valday_k34, K34_TAB.qty_ui_k34, K35_TAB.qty_k35, K35_TAB.up_k35, K35_TAB.daro_k35, K34_TAB.gennte_k34, K34_TAB.uptime_k34, K08_TAB.idnk08_k08, 
                         K11_TAB.idnk11_k11, K34_TAB.idnk34_k34, K35_TAB.idnk35_k35, K34_TAB.pn_rev_k34, K34_TAB.insmat_k34, K34_TAB.szip_k34, K34_TAB.ctlxml_k34, K34_TAB.qtek14_k34, dbo.k10_tab.idnk10_k10, dbo.kc4_tab.idnkc4_kc4, 
                         dbo.k33_tab.t_stat_k33, dbo.k33_tab.idnk33_k33, dbo.k10_tab.idnk31_k10, dbo.k09_tab.source_k09, dbo.k33_tab.t_stme_k33, dbo.k31_tab.c_code_k31, K35_TAB.upname_k35, K35_TAB.clin_k35
FROM            dbo.k35_tab AS K35_TAB INNER JOIN
                         dbo.k34_tab AS K34_TAB ON K35_TAB.idnk34_k35 = K34_TAB.idnk34_k34 INNER JOIN
                         dbo.k11_tab AS K11_TAB ON K34_TAB.idnk11_k34 = K11_TAB.idnk11_k11 INNER JOIN
                         dbo.k08_tab AS K08_TAB ON K11_TAB.idnk08_k11 = K08_TAB.idnk08_k08 INNER JOIN
                         dbo.k10_tab ON K11_TAB.idnk10_k11 = dbo.k10_tab.idnk10_k10 INNER JOIN
                         dbo.kc4_tab ON K08_TAB.idnk08_k08 = dbo.kc4_tab.idnk08_kc4 AND dbo.k10_tab.idnk10_k10 = dbo.kc4_tab.idnk10_kc4 INNER JOIN
                         dbo.k33_tab ON K34_TAB.idnk33_k34 = dbo.k33_tab.idnk33_k33 INNER JOIN
                         dbo.k09_tab ON K11_TAB.idnk09_k11 = dbo.k09_tab.idnk09_k09 INNER JOIN
                         dbo.k31_tab ON dbo.k10_tab.idnk31_k10 = dbo.k31_tab.idnk31_k31





