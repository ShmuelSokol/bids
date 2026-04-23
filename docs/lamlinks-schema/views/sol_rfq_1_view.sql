-- dbo.sol_rfq_1_view



/* view sol_rfq_1_view: add view */


/* view sol_rfq_1_view: add view */


/* view sol_rfq_1_view: add view */

/* view sol_rfq_1_view: add view */


/* view sol_rfq_1_view: add view */
CREATE VIEW dbo.sol_rfq_1_view
AS
SELECT        dbo.sol_abs_0_query.ref_no_k09, dbo.sol_abs_0_query.c_code_k31, dbo.sol_abs_0_query.sol_no_k10, dbo.sol_abs_0_query.itemno_k11, dbo.sol_abs_0_query.checkd_k11, dbo.sol_abs_0_query.pr_num_k11, 
                         dbo.sol_abs_0_query.partno_k08, dbo.sol_abs_0_query.p_cage_k08, dbo.sol_abs_0_query.p_desc_k08, dbo.sol_abs_0_query.niin_k08, dbo.sol_abs_0_query.fsc_k08, dbo.sol_abs_0_query.classa_k08, 
                         dbo.sol_abs_0_query.dflcnt_k08, dbo.sol_abs_0_query.i_note_k08, dbo.sol_abs_0_query.doccnt_k11, dbo.sol_abs_0_query.hittyp_k11, dbo.sol_abs_0_query.closes_k11, dbo.sol_abs_0_query.solqty_k11, 
                         dbo.sol_abs_0_query.sol_um_k11, dbo.sol_abs_0_query.estval_k11, dbo.sol_abs_0_query.dwgamc_k11, dbo.sol_abs_0_query.clrnam_k25, dbo.sol_abs_0_query.u_name_k11, dbo.sol_abs_0_query.b_code_k10, 
                         dbo.sol_abs_0_query.b_name_k10, dbo.sol_abs_0_query.b_phon_k10, dbo.sol_abs_0_query.b_fax_k10, dbo.sol_abs_0_query.sol_ti_k10, dbo.sol_abs_0_query.mqlife_k10, dbo.sol_abs_0_query.isudte_k10, 
                         dbo.sol_abs_0_query.closes_k10, dbo.sol_abs_0_query.prdqty_k11, dbo.sol_abs_0_query.fatqty_k11, dbo.sol_abs_0_query.optqty_k11, dbo.sol_abs_0_query.othqty_k11, dbo.sol_abs_0_query.saside_k10, 
                         dbo.sol_abs_0_query.cntpri_k10, dbo.sol_abs_0_query.buyeml_k10, dbo.sol_abs_0_query.bq_sta_k10, dbo.sol_abs_0_query.sxtnam_k10, dbo.sol_abs_0_query.picode_k11, dbo.sol_abs_0_query.fobcod_k11, 
                         dbo.sol_abs_0_query.amcode_k11, dbo.sol_abs_0_query.acqdes_k11, dbo.sol_abs_0_query.amcdes_k11, dbo.sol_abs_0_query.our_pn_k11, dbo.sol_abs_0_query.lxtnam_k11, dbo.sol_abs_0_query.lam_id_k11, 
                         dbo.sol_abs_0_query.slcnam_k21, dbo.sol_abs_0_query.sprnam_k24, dbo.sol_abs_0_query.spr_no_k24, dbo.sol_abs_0_query.idnk08_k08, dbo.sol_abs_0_query.idnk09_k09, dbo.sol_abs_0_query.idnk10_k10, 
                         dbo.sol_abs_0_query.idnk11_k11, dbo.sol_abs_0_query.idnk21_k21, dbo.sol_abs_0_query.idnk24_k24, dbo.sol_abs_0_query.idnk25_k25, dbo.sol_abs_0_query.refdte_k09, dbo.sol_abs_0_query.paklvl_k11, 
                         dbo.sol_abs_0_query.idnkc4_kc4, dbo.sol_abs_0_query.xmlstr_kc4, dbo.sol_abs_0_query.c_stat_kc4, dbo.sol_abs_0_query.c_time_kc4, dbo.sol_abs_0_query.cntrct_kc4, dbo.sol_abs_0_query.rel_no_kc4, 
                         dbo.sol_abs_0_query.reldte_kc4, dbo.sol_abs_0_query.a_cage_kc4, dbo.sol_abs_0_query.awdqty_kc4, dbo.sol_abs_0_query.awd_um_kc4, dbo.sol_abs_0_query.awd_up_kc4, dbo.sol_abs_0_query.a_name_kc4, 
                         dbo.sol_abs_0_query.o_name_kc4, dbo.sol_abs_0_query.srvqtt_kc4, dbo.sol_abs_0_query.source_k09, dbo.sol_abs_0_query.ourref_k09, dbo.sol_abs_0_query.seldes_k11, dbo.sol_abs_0_query.idnk12_k13, 
                         dbo.sol_abs_0_query.idnk12_myc, dbo.sol_abs_0_query.piidno_kc4, dbo.sol_abs_0_query.snq_21_k08, dbo.sol_abs_0_query.c_name_k31, dbo.sol_abs_0_query.k14own_kc4, dbo.sol_abs_0_query.idnk31_k31, 
                         dbo.k43_tab.idnk43_k43
FROM            dbo.k37_tab INNER JOIN
                         dbo.k45_tab ON dbo.k37_tab.idnk37_k37 = dbo.k45_tab.idnk37_k45 INNER JOIN
                         dbo.k43_tab ON dbo.k45_tab.idnk43_k45 = dbo.k43_tab.idnk43_k43 INNER JOIN
                         dbo.sol_abs_0_query ON dbo.k37_tab.idnvrq_k37 = dbo.sol_abs_0_query.idnk11_k11
WHERE        (dbo.k37_tab.vrqtyp_k37 = 'k11')





