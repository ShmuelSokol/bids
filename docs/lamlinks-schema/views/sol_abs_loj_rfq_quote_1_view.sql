-- dbo.sol_abs_loj_rfq_quote_1_view



/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */

/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */


/* view sol_abs_loj_rfq_quote_1_view: add view */
CREATE VIEW [dbo].[sol_abs_loj_rfq_quote_1_view]
AS
SELECT     dbo.sol_abs_0_query.ref_no_k09, dbo.sol_abs_0_query.c_code_k31, dbo.sol_abs_0_query.sol_no_k10, dbo.sol_abs_0_query.itemno_k11, 
                      dbo.sol_abs_0_query.checkd_k11, dbo.sol_abs_0_query.pr_num_k11, dbo.sol_abs_0_query.partno_k08, dbo.sol_abs_0_query.p_cage_k08, 
                      dbo.sol_abs_0_query.p_desc_k08, dbo.sol_abs_0_query.niin_k08, dbo.sol_abs_0_query.fsc_k08, dbo.sol_abs_0_query.classa_k08, 
                      dbo.sol_abs_0_query.dflcnt_k08, dbo.sol_abs_0_query.i_note_k08, dbo.sol_abs_0_query.doccnt_k11, dbo.sol_abs_0_query.hittyp_k11, 
                      dbo.sol_abs_0_query.closes_k11, dbo.sol_abs_0_query.solqty_k11, dbo.sol_abs_0_query.sol_um_k11, dbo.sol_abs_0_query.estval_k11, 
                      dbo.sol_abs_0_query.dwgamc_k11, dbo.sol_abs_0_query.clrnam_k25, dbo.sol_abs_0_query.u_name_k11, dbo.sol_abs_0_query.b_code_k10, 
                      dbo.sol_abs_0_query.b_name_k10, dbo.sol_abs_0_query.b_phon_k10, dbo.sol_abs_0_query.b_fax_k10, dbo.sol_abs_0_query.sol_ti_k10, 
                      dbo.sol_abs_0_query.isudte_k10, dbo.sol_abs_0_query.closes_k10, dbo.sol_abs_0_query.prdqty_k11, dbo.sol_abs_0_query.fatqty_k11, 
                      dbo.sol_abs_0_query.optqty_k11, dbo.sol_abs_0_query.othqty_k11, dbo.sol_abs_0_query.saside_k10, dbo.sol_abs_0_query.cntpri_k10, 
                      dbo.sol_abs_0_query.picode_k11, dbo.sol_abs_0_query.amcode_k11, dbo.sol_abs_0_query.acqdes_k11, dbo.sol_abs_0_query.amcdes_k11, 
                      dbo.sol_abs_0_query.our_pn_k11, dbo.sol_abs_0_query.lxtnam_k11, dbo.sol_abs_0_query.sxtnam_k10, dbo.sol_abs_0_query.buyeml_k10, 
                      dbo.sol_abs_0_query.lam_id_k11, dbo.sol_abs_0_query.slcnam_k21, dbo.sol_abs_0_query.sprnam_k24, dbo.sol_abs_0_query.spr_no_k24, 
                      dbo.sol_abs_0_query.idnk08_k08, dbo.sol_abs_0_query.idnk09_k09, dbo.sol_abs_0_query.idnk10_k10, dbo.sol_abs_0_query.idnk11_k11, 
                      dbo.sol_abs_0_query.idnk21_k21, dbo.sol_abs_0_query.idnk24_k24, dbo.sol_abs_0_query.idnk25_k25, dbo.sol_abs_0_query.idnk31_k31, 
                      dbo.vendor_quote_1_query.idnk43_k43, dbo.vendor_quote_1_query.idnk56_k56, dbo.vendor_quote_1_query.q_type_k56, dbo.vendor_quote_1_query.p_um_k56, 
                      dbo.vendor_quote_1_query.idnk57_k57, dbo.vendor_quote_1_query.untcst_k57, dbo.vendor_quote_1_query.dlyaro_k57, dbo.vendor_quote_1_query.valdte_k57, 
                      dbo.vendor_quote_1_query.idnk55_k55, dbo.vendor_quote_1_query.qotdte_k55, dbo.vendor_quote_1_query.qrefno_k55, dbo.sol_abs_0_query.paklvl_k11, 
                      dbo.sol_abs_0_query.fobcod_k11, dbo.sol_abs_0_query.idnkc4_kc4, dbo.sol_abs_0_query.srvqtt_kc4, dbo.sol_abs_0_query.idnk12_k13
FROM         dbo.sol_abs_0_query LEFT OUTER JOIN
                      dbo.vendor_quote_1_query ON dbo.sol_abs_0_query.idnk08_k08 = dbo.vendor_quote_1_query.idnk08_k08


















