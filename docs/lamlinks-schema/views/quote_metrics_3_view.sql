-- dbo.quote_metrics_3_view



/* view quote_metrics_3_view: add view */


/* view quote_metrics_3_view: add view */


/* view quote_metrics_3_view: add view */

/* view quote_metrics_3_view: add view */
CREATE VIEW dbo.quote_metrics_3_view
AS
SELECT        dbo.solicitation_line_1_view.sol_no_k10, dbo.solicitation_line_1_view.source_k09, dbo.solicitation_line_1_view.weight_k08, dbo.sol_part_6_view.idnkc4_kc4, dbo.solicitation_line_1_view.ref_no_k09, 
                         dbo.solicitation_line_1_view.refdte_k09, dbo.solicitation_line_1_view.pr_num_k11, dbo.solicitation_line_1_view.niin_k08, dbo.sol_part_6_view.piidno_kc4, dbo.sol_part_6_view.awd_up_kc4, dbo.sol_part_6_view.awdqty_kc4, 
                         dbo.sol_part_6_view.cntrct_kc4, dbo.sol_part_6_view.c_time_kc4, dbo.sol_part_6_view.adddte_kc4, dbo.basis_quote_5_view.s_code_k39, dbo.basis_quote_5_view.e_name_k12, dbo.basis_quote_5_view.rfq_no_k42, 
                         dbo.basis_quote_5_view.untcst_k57, dbo.basis_quote_5_view.p_um_k56, dbo.basis_quote_5_view.xc_cst_unt, dbo.basis_quote_5_view.xc_cst_lot, dbo.basis_quote_5_view.su_lbs_k56, 
                         dbo.solicitation_line_1_view.p_cage_k08, dbo.solicitation_line_1_view.partno_k08, dbo.solicitation_line_1_view.fsc_k08, dbo.solicitation_line_1_view.p_desc_k08, dbo.sol_part_6_view.a_cage_kc4, 
                         dbo.sol_part_6_view.c_stat_kc4, dbo.sol_part_6_view.rel_no_kc4, dbo.sol_part_6_view.reldte_kc4, dbo.sol_part_6_view.upddte_kc4, dbo.solicitation_line_1_view.idnk08_k08, dbo.solicitation_line_1_view.idnk09_k09, 
                         dbo.solicitation_line_1_view.idnk10_k10, dbo.solicitation_line_1_view.idnk11_k11, dbo.sol_part_6_view.xmlstr_kc4, dbo.cquote_line_3a_view.c_name_k13, dbo.cquote_line_3a_view.upname_k34, 
                         dbo.cquote_line_3a_view.bidtyp_k34, dbo.cquote_line_3a_view.mcage_k34, dbo.cquote_line_3a_view.pn_k34, dbo.cquote_line_3a_view.idnk34_k34, dbo.cquote_line_3a_view.qty_k35, dbo.cquote_line_3a_view.up_k35, 
                         dbo.cquote_line_3a_view.daro_k35, dbo.cquote_line_3a_view.idnk35_k35, dbo.cquote_line_3a_view.prdqty_kcg, dbo.cquote_line_3a_view.fatqty_kcg, dbo.cquote_line_3a_view.gennte_k34, 
                         dbo.cquote_line_3a_view.pkgnte_k34, dbo.cquote_line_3a_view.qty_ui_k34, dbo.cquote_line_3a_view.valday_k34, dbo.cquote_line_3a_view.uptime_k34, dbo.cquote_line_3a_view.fobcod_k34, 
                         dbo.cquote_line_3a_view.p0301_k34, dbo.cquote_line_3a_view.trmdes_k34, dbo.cquote_line_3a_view.scage_k34, dbo.cquote_line_3a_view.solqty_k34, dbo.cquote_line_3a_view.qrefno_k34, 
                         dbo.solicitation_line_1_view.sol_ti_k10, dbo.solicitation_line_1_view.isudte_k10, dbo.solicitation_line_1_view.closes_k10, dbo.solicitation_line_1_view.saside_k10, dbo.solicitation_line_1_view.estval_k11, 
                         dbo.solicitation_line_1_view.solqty_k11, dbo.solicitation_line_1_view.prdqty_k11, dbo.solicitation_line_1_view.itemno_k11, dbo.k08_tab.classa_k08, dbo.k08_tab.i_note_k08, dbo.k21_tab.slcnam_k21, 
                         dbo.k25_tab.clrnam_k25
FROM            dbo.basis_quote_5_view RIGHT OUTER JOIN
                         dbo.sol_part_6_view INNER JOIN
                         dbo.solicitation_line_1_view ON dbo.sol_part_6_view.idnkc4_kc4 = dbo.solicitation_line_1_view.idnkc4_kc4 INNER JOIN
                         dbo.k08_tab ON dbo.solicitation_line_1_view.idnk08_k08 = dbo.k08_tab.idnk08_k08 INNER JOIN
                         dbo.k21_tab ON dbo.solicitation_line_1_view.idnk21_k11 = dbo.k21_tab.idnk21_k21 INNER JOIN
                         dbo.k25_tab ON dbo.k21_tab.idnk25_k21 = dbo.k25_tab.idnk25_k25 LEFT OUTER JOIN
                         dbo.cquote_line_3a_view ON dbo.cquote_line_3a_view.idnkc4_kc4 = dbo.solicitation_line_1_view.idnkc4_kc4 ON dbo.basis_quote_5_view.idnkc4_kc4 = dbo.cquote_line_3a_view.idnkc4_kc4




