-- dbo.bot_job_3_view



/* view bot_job_3_view: add view */


/* view bot_job_3_view: add view */


/* view bot_job_3_view: add view */

/* view bot_job_3_view: add view */


/* view bot_job_3_view: add view */


/* view bot_job_3_view: add view */
CREATE VIEW [dbo].[bot_job_3_view]
AS
SELECT DISTINCT 
                         K09_tab.ref_no_k09, K31_tab.c_code_k31, K10_tab.sol_no_k10, K11_tab.itemno_k11, K11_tab.pr_num_k11, K08_tab.partno_k08, K08_tab.p_desc_k08, K08_tab.niin_k08, K08_tab.fsc_k08, K11_tab.closes_k11, 
                         K27_tab.ssaclr_k27, K27_tab.ssatyp_k27, K23_tab.sactyp_k23, K28_tab.jobrtm_k28, K28_tab.jobrst_k28, K28_tab.ssadds_k28, K28_tab.jobret_k28, K28_tab.jobtot_k28, K28_tab.jobcnt_k28, K28_tab.jobstt_k28, 
                         K08_tab.idnk08_k08, K09_tab.idnk09_k09, K10_tab.idnk10_k10, K11_tab.idnk11_k11, K23_tab.idnk23_k23, K27_tab.idnk27_k27, K28_tab.idnk27_k28, K28_tab.idnk28_k28, K31_tab.idnk31_k31, 
                         K10_tab.sol_ti_k10, K10_tab.isudte_k10, K10_tab.closes_k10
FROM            dbo.k31_tab AS K31_tab WITH (FORCESEEK, INDEX (k31_tab_idnk31_k31)) INNER JOIN
                         dbo.k11_tab AS K11_tab INNER JOIN
                         dbo.k09_tab AS K09_tab ON K11_tab.idnk09_k11 = K09_tab.idnk09_k09 INNER JOIN
                         dbo.k10_tab AS K10_tab ON K11_tab.idnk10_k11 = K10_tab.idnk10_k10 INNER JOIN
                         dbo.k08_tab AS K08_tab ON K11_tab.idnk08_k11 = K08_tab.idnk08_k08 ON K31_tab.idnk31_k31 = K10_tab.idnk31_k10 INNER JOIN
                         dbo.k27_tab AS K27_tab INNER JOIN
                         dbo.k28_tab AS K28_tab ON K27_tab.idnk27_k27 = K28_tab.idnk27_k28 INNER JOIN
                         dbo.k23_tab AS K23_tab ON K27_tab.idnk23_k27 = K23_tab.idnk23_k23 ON K11_tab.idnk11_k11 = K28_tab.idnsrq_k28
WHERE        (K28_tab.jobstt_k28 >= '1970-10-01 00:00:00') AND (K28_tab.srqtyp_k28 = 'k11')






