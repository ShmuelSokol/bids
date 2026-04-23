-- dbo.cquote_line_3_view



/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */

/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */


/* view cquote_line_3_view: add view */
/* view cquote_line_3_view: add view */
CREATE VIEW [dbo].[cquote_line_3_view]
AS
SELECT        K09_TAB.ref_no_k09, K09_TAB.refdte_k09, K11_TAB.pr_num_k11, K11_TAB.itemno_k11, K10_TAB.sol_no_k10, K08_TAB.niin_k08, K11_TAB.solqty_k11, K11_TAB.prdqty_k11, dbo.kcg_tab.fatqty_kcg, 
                         dbo.kcg_tab.prdqty_kcg, K34_TAB.solqty_k34, K11_TAB.estval_k11, K10_TAB.saside_k10, K10_TAB.closes_k10, K10_TAB.isudte_k10, K11_TAB.closes_k11, K08_TAB.fsc_k08, K08_TAB.partno_k08, 
                         K08_TAB.p_cage_k08, K21_TAB.slcnam_k21, K25_TAB.clrnam_k25, K08_TAB.p_desc_k08, K34_TAB.upname_k34, K34_TAB.bidtyp_k34, K34_TAB.qrefno_k34, K34_TAB.mcage_k34, K34_TAB.pn_k34, 
                         K34_TAB.scage_k34, K34_TAB.trmdes_k34, K34_TAB.p0301_k34, K34_TAB.fobcod_k34, K34_TAB.valday_k34, K34_TAB.qty_ui_k34, K35_TAB.qty_k35, K35_TAB.up_k35, K35_TAB.daro_k35, 
                         K34_TAB.gennte_k34, K34_TAB.pkgnte_k34, K34_TAB.uptime_k34, K08_TAB.idnk08_k08, K09_TAB.idnk09_k09, K10_TAB.idnk10_k10, K11_TAB.idnk11_k11, K34_TAB.idnk34_k34, K35_TAB.idnk35_k35, 
                         dbo.kc4_tab.idnkc4_kc4, dbo.kc4_tab.adddte_kc4, dbo.kc4_tab.upddte_kc4, dbo.kc4_tab.c_stat_kc4, dbo.kc4_tab.c_time_kc4, dbo.kc4_tab.cntrct_kc4, dbo.kc4_tab.rel_no_kc4, dbo.kc4_tab.reldte_kc4, 
                         dbo.kc4_tab.a_cage_kc4, dbo.kc4_tab.awdqty_kc4, dbo.kc4_tab.awd_up_kc4, dbo.kc4_tab.xmlstr_kc4, K10_TAB.sol_ti_k10, K08_TAB.classa_k08, K08_TAB.i_note_k08, dbo.k13_tab.c_name_k13, 
                         K09_TAB.source_k09, dbo.kc4_tab.piidno_kc4
FROM            dbo.k21_tab AS K21_TAB INNER JOIN
                         dbo.k35_tab AS K35_TAB INNER JOIN
                         dbo.k34_tab AS K34_TAB ON K35_TAB.idnk34_k35 = K34_TAB.idnk34_k34 INNER JOIN
                         dbo.k11_tab AS K11_TAB ON K34_TAB.idnk11_k34 = K11_TAB.idnk11_k11 INNER JOIN
                         dbo.k09_tab AS K09_TAB ON K11_TAB.idnk09_k11 = K09_TAB.idnk09_k09 INNER JOIN
                         dbo.k10_tab AS K10_TAB ON K11_TAB.idnk10_k11 = K10_TAB.idnk10_k10 INNER JOIN
                         dbo.k08_tab AS K08_TAB ON K11_TAB.idnk08_k11 = K08_TAB.idnk08_k08 INNER JOIN
                         dbo.kc4_tab LEFT OUTER JOIN
                         dbo.k13_tab ON dbo.kc4_tab.a_cage_kc4 = dbo.k13_tab.cage_k13 ON K10_TAB.idnk10_k10 = dbo.kc4_tab.idnk10_kc4 AND K08_TAB.idnk08_k08 = dbo.kc4_tab.idnk08_kc4 ON 
                         K21_TAB.idnk21_k21 = K11_TAB.idnk21_k11 INNER JOIN
                         dbo.k25_tab AS K25_TAB ON K21_TAB.idnk25_k21 = K25_TAB.idnk25_k25 LEFT OUTER JOIN
                         dbo.kcg_tab ON K09_TAB.idnk09_k09 = dbo.kcg_tab.idnk09_kcg AND dbo.kc4_tab.idnkc4_kc4 = dbo.kcg_tab.idnkc4_kcg









