-- dbo.quote_metrics_1_view



/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */

/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */


/* view quote_metrics_1_view: add view */
CREATE VIEW [dbo].[quote_metrics_1_view]
AS
SELECT        dbo.cquote_line_3a_view.ref_no_k09, dbo.cquote_line_3a_view.refdte_k09, dbo.cquote_line_3a_view.itemno_k11, dbo.cquote_line_3a_view.solqty_k11, dbo.cquote_line_3a_view.prdqty_k11, 
                         dbo.cquote_line_3a_view.estval_k11, dbo.cquote_line_3a_view.sol_no_k10, dbo.cquote_line_3a_view.sol_ti_k10, dbo.cquote_line_3a_view.isudte_k10, dbo.cquote_line_3a_view.saside_k10, 
                         dbo.cquote_line_3a_view.closes_k10, dbo.cquote_line_3a_view.pr_num_k11, dbo.cquote_line_3a_view.closes_k11, dbo.cquote_line_3a_view.fsc_k08, dbo.cquote_line_3a_view.niin_k08, 
                         dbo.cquote_line_3a_view.partno_k08, dbo.cquote_line_3a_view.p_cage_k08, dbo.cquote_line_3a_view.classa_k08, dbo.k08_tab.weight_k08, dbo.cquote_line_3a_view.slcnam_k21, 
                         dbo.cquote_line_3a_view.clrnam_k25, dbo.cquote_line_3a_view.p_desc_k08, dbo.cquote_line_3a_view.idnk08_k08, dbo.cquote_line_3a_view.idnk09_k09, dbo.cquote_line_3a_view.idnk10_k10, 
                         dbo.cquote_line_3a_view.idnk11_k11, dbo.cquote_line_3a_view.idnkc4_kc4, dbo.cquote_line_3a_view.adddte_kc4, dbo.cquote_line_3a_view.upddte_kc4, dbo.cquote_line_3a_view.c_stat_kc4, 
                         dbo.cquote_line_3a_view.c_time_kc4, dbo.cquote_line_3a_view.cntrct_kc4, dbo.cquote_line_3a_view.rel_no_kc4, dbo.cquote_line_3a_view.reldte_kc4, dbo.cquote_line_3a_view.a_cage_kc4, 
                         dbo.cquote_line_3a_view.awdqty_kc4, dbo.cquote_line_3a_view.awd_up_kc4, dbo.cquote_line_3a_view.xmlstr_kc4, dbo.cquote_line_3a_view.i_note_k08, dbo.cquote_line_3a_view.c_name_k13, 
                         dbo.cquote_line_3a_view.upname_k34, dbo.cquote_line_3a_view.bidtyp_k34, dbo.cquote_line_3a_view.qrefno_k34, dbo.cquote_line_3a_view.mcage_k34, dbo.cquote_line_3a_view.pn_k34, 
                         dbo.cquote_line_3a_view.scage_k34, dbo.cquote_line_3a_view.trmdes_k34, dbo.cquote_line_3a_view.p0301_k34, dbo.cquote_line_3a_view.fobcod_k34, dbo.cquote_line_3a_view.valday_k34, 
                         dbo.cquote_line_3a_view.solqty_k34, dbo.cquote_line_3a_view.qty_ui_k34, dbo.cquote_line_3a_view.gennte_k34, dbo.cquote_line_3a_view.pkgnte_k34, dbo.cquote_line_3a_view.uptime_k34, 
                         dbo.cquote_line_3a_view.idnk34_k34, dbo.cquote_line_3a_view.qty_k35, dbo.cquote_line_3a_view.up_k35, dbo.cquote_line_3a_view.daro_k35, dbo.cquote_line_3a_view.idnk35_k35, 
                         dbo.cquote_line_3a_view.idnkcg_kcg, dbo.cquote_line_3a_view.prdqty_kcg, dbo.cquote_line_3a_view.fatqty_kcg, dbo.cquote_line_3a_view.source_k09, dbo.cquote_line_3a_view.piidno_kc4, 
                         dbo.basis_quote_5_view.s_code_k39, dbo.basis_quote_5_view.e_name_k12, dbo.basis_quote_5_view.rfq_no_k42, dbo.basis_quote_5_view.untcst_k57, dbo.basis_quote_5_view.p_um_k56, 
                         dbo.basis_quote_5_view.xc_cst_unt, dbo.basis_quote_5_view.xc_cst_lot, dbo.basis_quote_5_view.su_lbs_k56
FROM            dbo.cquote_line_3a_view INNER JOIN
                         dbo.k08_tab ON dbo.cquote_line_3a_view.idnk08_k08 = dbo.k08_tab.idnk08_k08 LEFT OUTER JOIN
                         dbo.basis_quote_5_view ON dbo.cquote_line_3a_view.idnkc4_kc4 = dbo.basis_quote_5_view.idnkc4_kc4









