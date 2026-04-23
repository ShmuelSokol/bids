-- dbo.a



/* view a: add view */
CREATE VIEW dbo.a
AS
SELECT        K09_tab.ref_no_k09, K31_tab.c_code_k31, K10_tab.sol_no_k10, K11_tab.itemno_k11, K11_tab.checkd_k11, K11_tab.pr_num_k11, K08_tab.partno_k08, K08_tab.p_cage_k08, K08_tab.p_desc_k08, 
                         K08_tab.niin_k08, K08_tab.fsc_k08, K08_tab.classa_k08, K08_tab.dflcnt_k08, K08_tab.i_note_k08, K11_tab.doccnt_k11, K11_tab.hittyp_k11, K11_tab.closes_k11, K11_tab.solqty_k11, K11_tab.sol_um_k11, 
                         K11_tab.estval_k11, K11_tab.dwgamc_k11, K25_tab.clrnam_k25, K11_tab.u_name_k11, K10_tab.b_code_k10, K10_tab.b_name_k10, K10_tab.b_phon_k10, K10_tab.b_fax_k10, K10_tab.sol_ti_k10, 
                         K10_tab.isudte_k10, K10_tab.closes_k10, K11_tab.prdqty_k11, K11_tab.fatqty_k11, K11_tab.optqty_k11, K11_tab.othqty_k11, K10_tab.saside_k10, K10_tab.cntpri_k10, K10_tab.buyeml_k10, K11_tab.picode_k11, 
                         K11_tab.fobcod_k11, K11_tab.amcode_k11, K11_tab.acqdes_k11, K11_tab.amcdes_k11, K11_tab.our_pn_k11, K11_tab.lxtnam_k11, K10_tab.sxtnam_k10, K11_tab.lam_id_k11, K21_tab.slcnam_k21, 
                         K24_tab.sprnam_k24, K24_tab.spr_no_k24, K08_tab.idnk08_k08, K09_tab.idnk09_k09, K10_tab.idnk10_k10, K11_tab.idnk11_k11, K21_tab.idnk21_k21, K24_tab.idnk24_k24, K25_tab.idnk25_k25, 
                         K31_tab.idnk31_k31, K09_tab.refdte_k09, K11_tab.paklvl_k11, KC4_tab.idnkc4_kc4, KC4_tab.xmlstr_kc4, KC4_tab.c_stat_kc4, KC4_tab.c_time_kc4, KC4_tab.cntrct_kc4, KC4_tab.rel_no_kc4, KC4_tab.reldte_kc4, 
                         KC4_tab.a_cage_kc4, KC4_tab.awdqty_kc4, KC4_tab.awd_um_kc4, KC4_tab.awd_up_kc4, dbo.k13_tab.c_name_k13 AS a_name_kc4, ISNULL(dbo.k14_tab.u_name_k14, '') AS o_name_kc4, KC4_tab.srvqtt_kc4, 
                         K09_tab.source_k09, K09_tab.ourref_k09, K11_tab.seldes_k11, dbo.k13_tab.idnk12_k13, dbo.k13_tab.idnk12_k13 AS idnk12_myc, KC4_tab.piidno_kc4,
                             (SELECT        ISNULL(SUM(snq_21_k71), 0) AS snq_21_k08
                               FROM            dbo.k71_tab
                               WHERE        (idnk08_k71 = K08_tab.idnk08_k08)) AS snq_21_k08
FROM            dbo.k11_tab AS K11_tab INNER JOIN
                         dbo.k09_tab AS K09_tab WITH (FORCESEEK, INDEX (k09_tab_idnk09_k09)) ON K11_tab.idnk09_k11 = K09_tab.idnk09_k09 INNER JOIN
                         dbo.k10_tab AS K10_tab WITH (FORCESEEK, INDEX (k10_tab_idnk10_k10)) ON K11_tab.idnk10_k11 = K10_tab.idnk10_k10 INNER JOIN
                         dbo.k08_tab AS K08_tab WITH (FORCESEEK, INDEX (k08_tab_idnk08_k08)) ON K11_tab.idnk08_k11 = K08_tab.idnk08_k08 INNER JOIN
                         dbo.k21_tab AS K21_tab ON K11_tab.idnk21_k11 = K21_tab.idnk21_k21 INNER JOIN
                         dbo.k24_tab AS K24_tab ON K21_tab.idnk24_k21 = K24_tab.idnk24_k24 INNER JOIN
                         dbo.k25_tab AS K25_tab ON K21_tab.idnk25_k21 = K25_tab.idnk25_k25 INNER JOIN
                         dbo.k31_tab AS K31_tab WITH (FORCESEEK, INDEX (k31_tab_idnk31_k31)) ON K10_tab.idnk31_k10 = K31_tab.idnk31_k31 LEFT OUTER JOIN
                         dbo.kc4_tab AS KC4_tab WITH (FORCESEEK, INDEX (k08k10_kc4)) ON K10_tab.idnk10_k10 = KC4_tab.idnk10_kc4 AND K08_tab.idnk08_k08 = KC4_tab.idnk08_kc4 LEFT OUTER JOIN
                         dbo.k13_tab ON KC4_tab.a_cage_kc4 = dbo.k13_tab.cage_k13 LEFT OUTER JOIN
                         dbo.k14_tab ON KC4_tab.k14own_kc4 = dbo.k14_tab.idnk14_k14

